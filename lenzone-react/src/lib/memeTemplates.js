// Meme templates the board can use. Images are Imgflip's (url and size copied from its public list,
// api.imgflip.com/get_memes). Each template has a joke "shape" (what the format means) and text boxes
// measured on the image: [x, y, w, h] in percent, a style ('i' white Impact with outline, 'k' black text
// on the image's own blank area, 't' black label on a white tag), and optional fixed text.
//
// Shapes, with the texts each takes in order:
//   macro [top, bottom] (by mood)   prefer [rejected, preferred]   ignoreNotice [meh, wow]
//   surprise [setup, result]        awkward [look 1, look 2]       strongWeak [strong, weak]
//   notSame [you, me]               dilemma [button 1, button 2, who]
//   swerve [sensible road, exit taken, driver]   plan [step 1..4]   escalate [level 1..4]
//   tradeOffer [I receive, you receive]   handshake [left, right, what they share]
//   alwaysHasBeen [question, answer]   changeMind [take]   uno [what they won't do, who]
//   pigeon [who, thing, question]   right [plan, "..., right?"]   trophy [what they'd put there]
//   neglect [drowning, favorite, who]   tempted [temptation, who, the one ignored]
//   yell [accuser, cat]   slap [said, slapped with]   same [a, b]   bus [gloomy, sunny]   gloat [grave, who]
export const TEMPLATES = {
  "Leonardo Dicaprio Cheers": {"url":"https://i.imgflip.com/39t1o.jpg","w":600,"h":400,"shape":"macro","mood":"triumph","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "I'm The Captain Now": {"url":"https://i.imgflip.com/hlmst.jpg","w":478,"h":350,"shape":"macro","mood":"triumph","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "Absolute Cinema": {"url":"https://i.imgflip.com/8d317n.png","w":936,"h":725,"shape":"macro","mood":"triumph","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "Oprah You Get A": {"url":"https://i.imgflip.com/gtj5t.jpg","w":620,"h":465,"shape":"macro","mood":"triumph","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "Star Wars Yoda": {"url":"https://i.imgflip.com/8k0sa.jpg","w":620,"h":714,"shape":"macro","mood":"triumph","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "Laughing Leo": {"url":"https://i.imgflip.com/4acd7j.png","w":470,"h":470,"shape":"macro","mood":"laughAt","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "Roll Safe Think About It": {"url":"https://i.imgflip.com/1h7in3.jpg","w":702,"h":395,"shape":"macro","mood":"logic","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "This Is Fine": {"url":"https://i.imgflip.com/wxica.jpg","w":580,"h":282,"shape":"macro","mood":"pain","boxes":[[0,0,50,30,"i"],[0,72,100,28,"i"]]},
  "Bad Luck Brian": {"url":"https://i.imgflip.com/1bip.jpg","w":475,"h":562,"shape":"macro","mood":"pain","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "Hide the Pain Harold": {"url":"https://i.imgflip.com/gk5el.jpg","w":480,"h":601,"shape":"macro","mood":"pain","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "Sad Pablo Escobar": {"url":"https://i.imgflip.com/1c1uej.jpg","w":720,"h":709,"shape":"macro","mood":"pain","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "Waiting Skeleton": {"url":"https://i.imgflip.com/2fm6x.jpg","w":298,"h":403,"shape":"macro","mood":"waiting","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "Disaster Girl": {"url":"https://i.imgflip.com/23ls.jpg","w":500,"h":375,"shape":"macro","mood":"chaos","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "Squidward window": {"url":"https://i.imgflip.com/145qvv.jpg","w":598,"h":420,"shape":"macro","mood":"envy","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "Ancient Aliens": {"url":"https://i.imgflip.com/26am.jpg","w":500,"h":437,"shape":"macro","mood":"suspicious","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "Futurama Fry": {"url":"https://i.imgflip.com/1bgw.jpg","w":552,"h":414,"shape":"macro","mood":"suspicious","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "Third World Skeptical Kid": {"url":"https://i.imgflip.com/265k.jpg","w":426,"h":426,"shape":"macro","mood":"suspicious","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "Mocking Spongebob": {"url":"https://i.imgflip.com/1otk96.jpg","w":502,"h":353,"shape":"macro","mood":"mock","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "Grandma Finds The Internet": {"url":"https://i.imgflip.com/1bhw.jpg","w":640,"h":480,"shape":"macro","mood":"confused","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "Y'all Got Any More Of That": {"url":"https://i.imgflip.com/21uy0f.jpg","w":600,"h":471,"shape":"macro","mood":"more","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "Evil Kermit": {"url":"https://i.imgflip.com/1e7ql7.jpg","w":700,"h":325,"shape":"macro","mood":"evil","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "Pawn Stars Best I Can Do": {"url":"https://i.imgflip.com/19vcz0.jpg","w":624,"h":352,"shape":"macro","mood":"lowball","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "One Does Not Simply": {"url":"https://i.imgflip.com/1bij.jpg","w":568,"h":335,"shape":"macro","mood":"simply","boxes":[[0,0,100,24,"i"],[0,76,100,24,"i"]]},
  "Drake Hotline Bling": {"url":"https://i.imgflip.com/30b1gx.jpg","w":1200,"h":1200,"shape":"prefer","boxes":[[50,0,50,50,"k"],[50,50,50,50,"k"]]},
  "Tuxedo Winnie The Pooh": {"url":"https://i.imgflip.com/2ybua0.png","w":800,"h":582,"shape":"prefer","boxes":[[43,0,57,50,"k"],[43,50,57,50,"k"]]},
  "Sleeping Shaq": {"url":"https://i.imgflip.com/1nck6k.jpg","w":640,"h":631,"shape":"ignoreNotice","boxes":[[0,0,50,50,"k"],[0,50,50,50,"k"]]},
  "Surprised Pikachu": {"url":"https://i.imgflip.com/2kbn1e.jpg","w":1893,"h":1893,"shape":"surprise","boxes":[[3,1,94,18,"k"],[3,19,94,18,"k"]]},
  "Monkey Puppet": {"url":"https://i.imgflip.com/2gnnjh.jpg","w":923,"h":768,"shape":"awkward","boxes":[[2,1,96,17,"k"],[2,18,96,17,"k"]]},
  "Buff Doge vs. Cheems": {"url":"https://i.imgflip.com/43a45p.png","w":937,"h":720,"shape":"strongWeak","boxes":[[0,68,50,30,"k"],[52,68,48,30,"k"]]},
  "Gus Fring we are not the same": {"url":"https://i.imgflip.com/5o32tt.png","w":700,"h":1000,"shape":"notSame","boxes":[[0,0,100,18,"i"],[0,19,100,18,"i"],[0,82,100,18,"i","We are not the same"]]},
  "Two Buttons": {"url":"https://i.imgflip.com/1g8my4.jpg","w":600,"h":908,"shape":"dilemma","boxes":[[6,9,32,11,"t"],[40,4,32,11,"t"],[0,78,100,22,"i"]]},
  "Left Exit 12 Off Ramp": {"url":"https://i.imgflip.com/22bdq6.jpg","w":804,"h":767,"shape":"swerve","boxes":[[46,9,34,18,"t"],[20,3,24,10,"t"],[40,62,44,14,"t"]]},
  "Gru's Plan": {"url":"https://i.imgflip.com/26jxvz.jpg","w":700,"h":449,"shape":"plan","boxes":[[28,3,21,43,"k"],[78,3,21,43,"k"],[28,53,21,43,"k"],[78,53,21,43,"k"]]},
  "Expanding Brain": {"url":"https://i.imgflip.com/1jwhww.jpg","w":857,"h":1202,"shape":"escalate","boxes":[[0,0,48,24,"k"],[0,25,48,24,"k"],[0,50,48,23,"k"],[0,74,48,26,"k"]]},
  "Clown Applying Makeup": {"url":"https://i.imgflip.com/38el31.jpg","w":750,"h":798,"shape":"escalate","boxes":[[0,0,60,25,"k"],[0,25,60,25,"k"],[0,50,60,25,"k"],[0,75,60,25,"k"]]},
  "Trade Offer": {"url":"https://i.imgflip.com/54hjww.jpg","w":607,"h":794,"shape":"tradeOffer","boxes":[[0,24,50,16,"i"],[50,24,50,16,"i"]]},
  "Epic Handshake": {"url":"https://i.imgflip.com/28j0te.jpg","w":900,"h":645,"shape":"handshake","boxes":[[0,62,36,14,"t"],[64,56,36,14,"t"],[28,6,44,14,"t"]]},
  "Always Has Been": {"url":"https://i.imgflip.com/46e43q.png","w":960,"h":540,"shape":"alwaysHasBeen","boxes":[[0,2,60,30,"i"],[60,2,40,30,"i"]]},
  "Change My Mind": {"url":"https://i.imgflip.com/24y43o.jpg","w":482,"h":361,"shape":"changeMind","boxes":[[44,56,48,17,"k"]]},
  "UNO Draw 25 Cards": {"url":"https://i.imgflip.com/3lmzyx.jpg","w":500,"h":494,"shape":"uno","boxes":[[8,28,38,22,"k"],[52,1,47,14,"t"]]},
  "Is This A Pigeon": {"url":"https://i.imgflip.com/1o00in.jpg","w":1587,"h":1425,"shape":"pigeon","boxes":[[8,40,34,10,"t"],[58,6,40,10,"t"],[0,80,100,20,"i"]]},
  "Anakin Padme 4 Panel": {"url":"https://i.imgflip.com/5c7lwq.png","w":768,"h":768,"shape":"right","boxes":[[0,32,50,17,"i"],[50,32,50,17,"i"]]},
  "This Is Where I'd Put My Trophy If I Had One": {"url":"https://i.imgflip.com/1wz1x.jpg","w":300,"h":418,"shape":"trophy","boxes":[[0,0,100,22,"i"],[0,82,100,18,"i","If I had one"]]},
  "Mother Ignoring Kid Drowning In A Pool": {"url":"https://i.imgflip.com/46hhvr.jpg","w":782,"h":1032,"shape":"neglect","boxes":[[0,28,34,10,"t"],[26,3,42,9,"t"],[60,30,40,9,"t"]]},
  "Distracted Boyfriend": {"url":"https://i.imgflip.com/1ur9b0.jpg","w":1200,"h":800,"shape":"tempted","boxes":[[2,50,38,13,"t"],[40,26,28,13,"t"],[70,34,30,13,"t"]]},
  "Woman Yelling At Cat": {"url":"https://i.imgflip.com/345v97.jpg","w":680,"h":438,"shape":"yell","boxes":[[0,13,50,22,"i"],[50,13,50,22,"i"]]},
  "Batman Slapping Robin": {"url":"https://i.imgflip.com/9ehk.jpg","w":400,"h":387,"shape":"slap","boxes":[[3,3,43,24,"k"],[53,3,44,24,"k"]]},
  "spiderman pointing at spiderman": {"url":"https://i.imgflip.com/1tkjq9.jpg","w":800,"h":450,"shape":"same","boxes":[[2,45,42,12,"t"],[56,45,42,12,"t"]]},
  "Two guys on a bus": {"url":"https://i.imgflip.com/5v6gwj.jpg","w":762,"h":675,"shape":"bus","boxes":[[2,2,46,14,"t"],[52,2,46,14,"t"]]},
  "Grant Gustin over grave": {"url":"https://i.imgflip.com/3nx72a.png","w":500,"h":475,"shape":"gloat","boxes":[[22,22,25,26,"k"],[50,44,46,10,"t"]]}
};
