import datetime
import pandas as pd
import requests
import streamlit as st

# ==========================================
# 1. PAGE CONFIGURATION & STYLING
# ==========================================
st.set_page_config(
    page_title="LENZONE Fantasy League 2026",
    page_icon="🏈",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.markdown(
    """
    <style>
    .main-title { font-size: 2.2rem; font-weight: 800; color: #1E3A8A; margin-bottom: 0px; }
    .sub-title { font-size: 1.0rem; color: #4B5563; margin-bottom: 15px; }
    </style>
""",
    unsafe_allow_html=True,
)

# ==========================================
# 2. CONSTANTS & LEAGUE ROSTERS
# ==========================================
# Sleeper League IDs (Replace with your live IDs after draft night)
SLEEPER_AFC_LEAGUE_ID = "kMmNlY3zZjDJk"
SLEEPER_NFC_LEAGUE_ID = "LVlzR63lwzVVO"

AFC_TEAMS = [
    "Kenny", "Grant", "Rob", "Tim", "Ted", "Nikko",
    "Dan", "Maggie", "Arjun", "Mina", "Mike", "Jaime + Kelsee"
]

NFC_TEAMS = [
    "Alanna", "Kruti", "Mario", "Ahmad", "Melody", "Kris + Mahtab",
    "David C", "Eric", "Sam", "Jeremy", "Chris", "Melissa"
]

# ==========================================
# 3. CORE SCHEDULING & API LOGIC
# ==========================================
def generate_14_week_schedule():
    """Generates a balanced 14-week cross-conference matchup schedule."""
    schedule = []
    num_teams = len(AFC_TEAMS)
    for week in range(1, 15):
        shift = (week - 1) % num_teams
        shifted_nfc = NFC_TEAMS[shift:] + NFC_TEAMS[:shift]
        for afc_p, nfc_p in zip(AFC_TEAMS, shifted_nfc):
            schedule.append({
                "Week": f"Week {week}",
                "Week_Num": week,
                "AFC Team": afc_p,
                "NFC Team": nfc_p,
                "Matchup": f"{afc_p} (AFC) vs {nfc_p} (NFC)"
            })
    return pd.DataFrame(schedule)

df_schedule = generate_14_week_schedule()

def get_cache_ttl():
    """Refreshes every 60 seconds on game days (Sun/Mon), hourly mid-week."""
    today = datetime.datetime.now().weekday()
    return 60 if today in [0, 6] else 3600

@st.cache_data(ttl=get_cache_ttl())
def fetch_sleeper_league(league_id):
    """Fetches public Sleeper league info without auth tokens."""
    url = f"https://api.sleeper.app/v1/league/{league_id}"
    try:
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            return res.json()
    except Exception:
        pass
    return None

# ==========================================
# 4. HEADER & DIRECT APP LINKS
# ==========================================
st.markdown("<div class='main-title'>🏈 LENZONE HUB 2026</div>", unsafe_allow_html=True)
st.markdown("<div class='sub-title'>LENZ Therapeutics Dual-Conference Fantasy League</div>", unsafe_allow_html=True)

col_link1, col_link2 = st.columns(2)
with col_link1:
    st.link_button("🚀 Open AFC Conference App (Sleeper)", "https://sleeper.com/i/JKqjODW7nOaXY", use_container_width=True)
with col_link2:
    st.link_button("🚀 Open NFC Conference App (Sleeper)", "http://sleeper.com/i/LVlzR63lwzVVO", use_container_width=True)

st.markdown("---")

# ==========================================
# 5. NAVIGATION TABS
# ==========================================
tab_standings, tab_matchups, tab_recap, tab_charter = st.tabs([
    "🏆 Standings & Analytics",
    "⚔️ Weekly Matchup Center",
    "📢 MS Teams Broadcast",
    "📜 League Charter & Guide"
])

# ------------------------------------------
# TAB 1: STANDINGS & ANALYTICS
# ------------------------------------------
with tab_standings:
    st.subheader("24-Team Combined Standings")
    conf_choice = st.radio("Conference View", ["Combined 24-Team", "AFC Only", "NFC Only"], horizontal=True)

    teams_to_display = (
        AFC_TEAMS + NFC_TEAMS if conf_choice == "Combined 24-Team" 
        else (AFC_TEAMS if conf_choice == "AFC Only" else NFC_TEAMS)
    )

    standings_data = []
    for rank, mgr in enumerate(teams_to_display, 1):
        standings_data.append({
            "Rank": rank,
            "Manager": mgr,
            "Conference": "AFC" if mgr in AFC_TEAMS else "NFC",
            "Standings Pts": 0.0,
            "In-Conf Record": "0-0 (0.0 pts)",
            "Cross-Conf Record": "0-0 (0.0 pts)",
            "Points For (PF)": 0.00,
            "FAAB Left": "$100"
        })

    st.dataframe(pd.DataFrame(standings_data), hide_index=True, use_container_width=True)
    st.info("💡 **Playoff Rule:** Seeds 1–5 qualify by total Standings Points. Seed 6 goes to highest Points For (PF) among remaining teams.")

# ------------------------------------------
# TAB 2: MATCHUP CENTER
# ------------------------------------------
with tab_matchups:
    st.subheader("Weekly Matchup Center")
    col_w1, col_w2 = st.columns([1, 2])

    with col_w1:
        sel_week = st.selectbox("Select Regular Season Week", [f"Week {i}" for i in range(1, 15)])
    with col_w2:
        sel_mgr = st.selectbox("Select Manager Filter", ["All Managers"] + AFC_TEAMS + NFC_TEAMS)

    if sel_mgr != "All Managers":
        st.markdown(f"### Matchup Breakdown: **{sel_mgr}** ({sel_week})")
        match_row = df_schedule[
            (df_schedule["Week"] == sel_week) & 
            ((df_schedule["AFC Team"] == sel_mgr) | (df_schedule["NFC Team"] == sel_mgr))
        ].iloc[0]
        cross_opp = match_row["NFC Team"] if sel_mgr in AFC_TEAMS else match_row["AFC Team"]

        m_col1, m_col2 = st.columns(2)
        with m_col1:
            st.markdown("#### Game 1: In-Conference (Sleeper)")
            st.metric("In-Conf Game Score", "0.00 pts", delta="Max 2.0 Standings Pts")
        with m_col2:
            st.markdown(f"#### Game 2: Cross-Conference vs {cross_opp}")
            st.metric("Cross-Conf Game Score", "0.00 pts", delta="Max 1.0 Standings Pt")
    else:
        st.markdown(f"### Full Inter-League Schedule Grid ({sel_week})")
        df_wk = df_schedule[df_schedule["Week"] == sel_week]
        st.dataframe(df_wk[["AFC Team", "NFC Team", "Matchup"]], hide_index=True, use_container_width=True)

# ------------------------------------------
# TAB 3: MS TEAMS RECAP GENERATOR
# ------------------------------------------
with tab_recap:
    st.subheader("MS Teams Weekly Announcement Generator")
    st.caption("Copy and paste this markdown text directly into your office chat every Tuesday morning.")

    recap_wk = st.selectbox("Generate Announcement For", [f"Week {i}" for i in range(1, 15)])
    
    announcement_text = f"""
========================================
🏈 **LENZONE WEEKLY RECAP: {recap_wk.upper()}** 🏈
========================================
• **Cross-League Rivalry:** AFC vs NFC match updates are live!
• **$15 High Score Winner:** TBD ($15 payout)
• **Seed 6 Wildcard Race (Points For):**
  - AFC Leader: TBD
  - NFC Leader: TBD

📊 **View Full Standings & Scoreboard:** https://lenzone.streamlit.app
    """
    st.code(announcement_text, language="markdown")

# ------------------------------------------
# TAB 4: LEAGUE CHARTER
# ------------------------------------------
with tab_charter:
    st.subheader("📜 LENZONE Official Rules & Charter")
    st.markdown("""
    * **Buy-In:** $50/team ($1,200 total prize pool).
    * **Draft Night:** Monday, Sept 1st at Culture Brewing.
    * **Waiver Budget:** $100 FAAB per team.
    * **Scoring Rules:**
      * **In-Conference Win:** 2.0 Standings Pts | **Tie:** 1.0 Pt
      * **Cross-Conference Win:** 1.0 Standings Pt | **Tie:** 0.5 Pt
    * **Stat Corrections:** Stat changes lock **Thursday at 9:00 AM PST**. Post-Thursday corrections will not adjust weekly payouts.
    * **Weekly High Score:** $15 prize awarded each week to highest overall scoring team across both conferences.
    * **Championship Tiebreaker:** Most total bench points in Week 17.
    """)