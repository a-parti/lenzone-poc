import datetime
import pandas as pd
import requests
import streamlit as st

# ==========================================
# 1. PAGE SETUP & STYLING
# ==========================================
st.set_page_config(
    page_title="LENZONE Fantasy League 2026",
    page_icon="🏈",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
    <style>
    .main-title { font-size: 2.2rem; font-weight: 800; color: #1E3A8A; margin-bottom: 0px; }
    .sub-title { font-size: 1.0rem; color: #4B5563; margin-bottom: 15px; }
    .card { background-color: #F3F4F6; padding: 15px; border-radius: 10px; border-left: 5px solid #1E3A8A; }
    </style>
""", unsafe_allow_html=True)

# ==========================================
# 2. DEFAULT CONFIG & ROSTERS
# ==========================================
AFC_TEAMS_DEFAULT = [
    "Kenny", "Grant", "Rob", "Tim", "Ted", "Nikko", 
    "Dan", "Maggie", "Arjun", "Mina", "Mike", "Jaime + Kelsee"
]

NFC_TEAMS_DEFAULT = [
    "Alanna", "Kruti", "Mario", "Ahmad", "Melody", "Kris + Mahtab", 
    "David C", "Eric", "Sam", "Jeremy", "Chris", "Melissa"
]

# ==========================================
# 3. SIDEBAR CONFIGURATION
# ==========================================
st.sidebar.title("⚙️ LENZONE Settings")
st.sidebar.info("Enter your 18-digit Sleeper League IDs below to connect live data.")

sleper_afc_id = st.sidebar.text_input("AFC League ID (Sleeper)", value="", placeholder="e.g. 104812345678901234")
sleper_nfc_id = st.sidebar.text_input("NFC League ID (Sleeper)", value="", placeholder="e.g. 104898765432109876")

st.sidebar.markdown("---")
st.sidebar.markdown("### 🔗 Quick App Links")
st.sidebar.markdown("[Open Sleeper AFC League](https://sleeper.com/i/JKqjODW7nOaXY)")
st.sidebar.markdown("[Open Sleeper NFC League](http://sleeper.com/i/LVlzR63lwzVVO)")

# ==========================================
# 4. SLEEPER API ENGINE
# ==========================================
@st.cache_data(ttl=300)
def fetch_sleeper_league_data(league_id):
    """Fetches public league info, rosters, and manager names from Sleeper REST API."""
    if not league_id or len(league_id.strip()) < 10:
        return None, []
    
    base_url = f"https://api.sleeper.app/v1/league/{league_id.strip()}"
    try:
        # 1. Fetch League Info
        league_res = requests.get(base_url, timeout=5)
        if league_res.status_code != 200:
            return None, []
        league_data = league_res.json()

        # 2. Fetch Users
        users_res = requests.get(f"{base_url}/users", timeout=5).json()
        user_map = {
            u["user_id"]: u.get("metadata", {}).get("team_name") or u.get("display_name") 
            for u in users_res
        }

        # 3. Fetch Rosters
        rosters_res = requests.get(f"{base_url}/rosters", timeout=5).json()
        parsed_rosters = []

        for roster in rosters_res:
            owner_id = roster.get("owner_id")
            manager_name = user_map.get(owner_id, f"Team {roster['roster_id']}")
            settings = roster.get("settings", {})
            
            wins = settings.get("wins", 0)
            losses = settings.get("losses", 0)
            ties = settings.get("ties", 0)
            
            fpts = settings.get("fpts", 0)
            fpts_dec = settings.get("fpts_decimal", 0)
            pf = float(f"{fpts}.{fpts_dec:02d}") if fpts_dec else float(fpts)

            parsed_rosters.append({
                "Manager": manager_name,
                "In_Conf_Wins": wins,
                "In_Conf_Losses": losses,
                "In_Conf_Ties": ties,
                "In_Conf_Record": f"{wins}-{losses}-{ties}",
                "In_Conf_Pts": (wins * 2.0) + (ties * 1.0),
                "Points For (PF)": pf,
                "FAAB Remaining": f"${100 - settings.get('waiver_budget_used', 0)}"
            })

        return league_data, parsed_rosters

    except Exception:
        return None, []

# Fetch Live API Data
afc_info, afc_api_rosters = fetch_sleeper_league_data(sleper_afc_id)
nfc_info, nfc_api_rosters = fetch_sleeper_league_data(sleper_nfc_id)

# Fallback to default team list if API isn't connected yet
afc_managers = [r["Manager"] for r in afc_api_rosters] if afc_api_rosters else AFC_TEAMS_DEFAULT
nfc_managers = [r["Manager"] for r in nfc_api_rosters] if nfc_api_rosters else NFC_TEAMS_DEFAULT

# ==========================================
# 5. CROSS-CONFERENCE SCHEDULER (14 WEEKS)
# ==========================================
def generate_cross_conference_schedule(afc_list, nfc_list):
    """Generates a balanced 14-week cross-conference matrix."""
    schedule = []
    num_teams = max(len(afc_list), len(nfc_list))
    
    # Fill padding if lists aren't equal
    a_padded = afc_list + [f"AFC Team {i}" for i in range(len(afc_list)+1, num_teams+1)]
    n_padded = nfc_list + [f"NFC Team {i}" for i in range(len(nfc_list)+1, num_teams+1)]

    for week in range(1, 15):
        shift = (week - 1) % num_teams
        shifted_nfc = n_padded[shift:] + n_padded[:shift]
        
        for afc_p, nfc_p in zip(a_padded[:12], shifted_nfc[:12]):
            schedule.append({
                "Week": f"Week {week}",
                "Week_Num": week,
                "AFC Team": afc_p,
                "NFC Team": nfc_p,
                "Matchup": f"{afc_p} (AFC) vs {nfc_p} (NFC)"
            })
    return pd.DataFrame(schedule)

df_schedule = generate_cross_conference_schedule(afc_managers, nfc_managers)

# ==========================================
# 6. HEADER & QUICK LINKS
# ==========================================
st.markdown("<div class='main-title'>🏈 LENZONE HUB 2026</div>", unsafe_allow_html=True)
st.markdown("<div class='sub-title'>LENZ Therapeutics Dual-Conference Fantasy League</div>", unsafe_allow_html=True)

col_top1, col_top2 = st.columns(2)
with col_top1:
    afc_status = afc_info.get("name", "AFC Conference") if afc_info else "AFC Conference (Offline Mode)"
    st.link_button(f"🚀 Open {afc_status} App", "https://sleeper.com/i/JKqjODW7nOaXY", use_container_width=True)
with col_top2:
    nfc_status = nfc_info.get("name", "NFC Conference") if nfc_info else "NFC Conference (Offline Mode)"
    st.link_button(f"🚀 Open {nfc_status} App", "http://sleeper.com/i/LVlzR63lwzVVO", use_container_width=True)

st.markdown("---")

# ==========================================
# 7. MAIN TABS
# ==========================================
tab_standings, tab_matchups, tab_recap, tab_charter = st.tabs([
    "🏆 Live Standings & Wildcard Race", 
    "⚔️ Weekly Matchup Center", 
    "📢 MS Teams Broadcast Generator", 
    "📜 Rules & Charter"
])

# ------------------------------------------
# TAB 1: STANDINGS ENGINE
# ------------------------------------------
with tab_standings:
    st.subheader("24-Team Combined League Standings")
    conf_filter = st.radio("Conference View", ["Combined 24-Team", "AFC Only", "NFC Only"], horizontal=True)

    # Build Standings Dataset
    combined_rows = []
    
    # Add AFC
    for idx, mgr in enumerate(afc_managers):
        api_data = next((r for r in afc_api_rosters if r["Manager"] == mgr), None)
        in_conf_rec = api_data["In_Conf_Record"] if api_data else "0-0-0"
        in_conf_pts = api_data["In_Conf_Pts"] if api_data else 0.0
        pf = api_data["Points For (PF)"] if api_data else 0.00
        faab = api_data["FAAB Remaining"] if api_data else "$100"

        combined_rows.append({
            "Manager": mgr,
            "Conference": "AFC",
            "In-Conf Record": in_conf_rec,
            "In-Conf Pts (2.0/win)": in_conf_pts,
            "Cross-Conf Record": "0-0-0",
            "Cross-Conf Pts (1.0/win)": 0.0,
            "Total Standings Pts": in_conf_pts + 0.0,
            "Points For (PF)": pf,
            "FAAB Left": faab
        })

    # Add NFC
    for idx, mgr in enumerate(nfc_managers):
        api_data = next((r for r in nfc_api_rosters if r["Manager"] == mgr), None)
        in_conf_rec = api_data["In_Conf_Record"] if api_data else "0-0-0"
        in_conf_pts = api_data["In_Conf_Pts"] if api_data else 0.0
        pf = api_data["Points For (PF)"] if api_data else 0.00
        faab = api_data["FAAB Remaining"] if api_data else "$100"

        combined_rows.append({
            "Manager": mgr,
            "Conference": "NFC",
            "In-Conf Record": in_conf_rec,
            "In-Conf Pts (2.0/win)": in_conf_pts,
            "Cross-Conf Record": "0-0-0",
            "Cross-Conf Pts (1.0/win)": 0.0,
            "Total Standings Pts": in_conf_pts + 0.0,
            "Points For (PF)": pf,
            "FAAB Left": faab
        })

    df_standings = pd.DataFrame(combined_rows)

    if conf_filter == "AFC Only":
        df_standings = df_standings[df_standings["Conference"] == "AFC"]
    elif conf_filter == "NFC Only":
        df_standings = df_standings[df_standings["Conference"] == "NFC"]

    # Sort by Standings Points first, then Points For
    df_standings = df_standings.sort_values(by=["Total Standings Pts", "Points For (PF)"], ascending=False)
    df_standings.insert(0, "Rank", range(1, len(df_standings) + 1))

    st.dataframe(df_standings, hide_index=True, use_container_width=True)

    st.info("""
    💡 **Playoff Seeding Formula:**
    * **Seeds 1–5:** Qualified automatically by highest **Total Standings Points**.
    * **Seed 6 (Wildcard):** Awarded to the remaining team with the highest **Points For (PF)** regardless of Standings Points!
    """)

# ------------------------------------------
# TAB 2: MATCHUP CENTER
# ------------------------------------------
with tab_matchups:
    st.subheader("Weekly Matchup Center")
    col_w1, col_w2 = st.columns([1, 2])

    with col_w1:
        sel_week = st.selectbox("Select Regular Season Week", [f"Week {i}" for i in range(1, 15)])
    with col_w2:
        all_managers = afc_managers + nfc_managers
        sel_mgr = st.selectbox("Filter Manager Matchup", ["All Managers"] + all_managers)

    if sel_mgr != "All Managers":
        st.markdown(f"### Matchup Card: **{sel_mgr}** ({sel_week})")
        
        # Cross-Conference lookup from schedule matrix
        match_row = df_schedule[
            (df_schedule["Week"] == sel_week) & 
            ((df_schedule["AFC Team"] == sel_mgr) | (df_schedule["NFC Team"] == sel_mgr))
        ].iloc[0]
        
        is_afc = sel_mgr in afc_managers
        cross_opp = match_row["NFC Team"] if is_afc else match_row["AFC Team"]

        col_m1, col_m2 = st.columns(2)
        with col_m1:
            st.markdown("#### Game 1: In-Conference (Sleeper App)")
            st.caption("Score and opponent managed inside Sleeper")
            st.metric("In-Conf Result", "0.00 pts", delta="Max 2.0 Standings Pts")
            
        with col_m2:
            st.markdown(f"#### Game 2: Cross-Conference vs {cross_opp}")
            st.caption("Score tracked externally on LENZONE Hub")
            st.metric("Cross-Conf Result", "0.00 pts", delta="Max 1.0 Standings Pt")
    else:
        st.markdown(f"### Full Cross-Conference Schedule Grid ({sel_week})")
        df_wk = df_schedule[df_schedule["Week"] == sel_week]
        st.dataframe(df_wk[["AFC Team", "NFC Team", "Matchup"]], hide_index=True, use_container_width=True)

# ------------------------------------------
# TAB 3: MS TEAMS RECAP GENERATOR
# ------------------------------------------
with tab_recap:
    st.subheader("📢 MS Teams Announcement Generator")
    st.caption("Copy and paste this markdown recap directly into your office MS Teams channel every Tuesday morning.")

    recap_wk = st.selectbox("Generate Announcement For", [f"Week {i}" for i in range(1, 15)])
    
    announcement_text = f"""
========================================
🏈 **LENZONE WEEKLY RECAP: {recap_wk.upper()}** 🏈
========================================
• **Cross-League Rivalry:** AFC vs NFC matchups for {recap_wk} are finalized!
• **$15 High Score Winner:** TBD ($15 payout)
• **Seed 6 Wildcard Race (Points For):**
  - AFC PF Leader: TBD
  - NFC PF Leader: TBD

📊 **View Full Standings & Scoreboard:** https://lenzone.streamlit.app
========================================
    """
    st.code(announcement_text, language="markdown")

# ------------------------------------------
# TAB 4: LEAGUE CHARTER
# ------------------------------------------
with tab_charter:
    st.subheader("📜 LENZONE 2026 Official Charter & Rules")
    st.markdown("""
    ### 💰 Financials & Draft Night
    * **Buy-In:** $50 per team ($1,200 total prize pool).
    * **Draft Night:** Monday, Sept 1st at Culture Brewing.
    * **Waiver Budget:** $100 FAAB per team per conference.

    ---

    ### 🎯 Dual-Scoring System
    Each team plays **two games per week** during the 14-week regular season:
    * **Game 1 (In-Conference):** Win = **2.0 Standings Pts** | Tie = **1.0 Pt** | Loss = **0 Pts**
    * **Game 2 (Cross-Conference):** Win = **1.0 Standings Pt** | Tie = **0.5 Pt** | Loss = **0 Pts**

    ---

    ### 🏆 Playoff Structure & Wildcard Rules
    * Each conference runs its own 6-team playoff bracket (Weeks 15–17).
    * **Seeds 1 & 2:** Get a First-Round Bye in Week 15.
    * **Seeds 1–5:** Qualified by overall Standings Points.
    * **Seed 6 (Points For Wildcard):** Awarded to the remaining team with the highest total **Points For (PF)**.
    * **Overall League Champion:** Decided by whichever conference champion (AFCCG Winner vs NFCCG Winner) scores the higher single-game total score in Week 17!

    ---

    ### ⏰ Stat Corrections & Weekly High Score
    * **Stat Correction Cutoff:** Stat changes lock every **Thursday at 9:00 AM PST**. Post-Thursday stat corrections will not adjust previous weekly standings or payouts.
    * **Weekly High Score Prize:** $15 payout awarded each week to the single highest-scoring team overall across both 12-team leagues.
    """)