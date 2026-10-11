/* Exercise catalog: 84 exercises (74 with evidence of muscle growth) with technique figures, coaching marks and faults. Ported from the prototype. */
import {LIB} from './library.js';
/* ---------- Muscles, exercises, plans ---------- */
const MUSCLES={chest:'Klatka',back:'Plecy',delts:'Barki',biceps:'Biceps',triceps:'Triceps',quads:'Czworogłowe',hams:'Dwugłowe ud',glutes:'Pośladki',calves:'Łydki',abs:'Brzuch'};
const PATTERNS=[['knee','Przysiad i wykrok'],['hinge','Zawias biodrowy'],['hpush','Pchanie poziome'],['vpush','Pchanie pionowe'],['hpull','Przyciąganie poziome'],['vpull','Przyciąganie pionowe'],['iso','Izolacja: ramiona, barki, nogi'],['core','Core i noszenie']];
/* Pose fields: a=ankle, a2=far ankle, hip, sh, t=torso angle, hand, hand2, ks/es=bend side, ft=foot angle, h=head angle.
   {sh:[dx,dy]} / {hip:[dx,dy]} / {a:[dx,dy]} are offsets from that joint. Angles in degrees, 0 = facing direction, 90 = up. */
const EX={
 squat:{n:'Przysiad ze sztangą',en:'Back squat',p:'knee',kind:'bar',inc:2.5,m:{quads:1,glutes:1},
  cues:['Sztanga na górze czworobocznych, łokcie pod gryfem','Wdech i napięty brzuch przed zejściem','Kolana podążają nad palcami stóp','Zejdź co najmniej do równoległej, stopy całe na podłodze'],
  err:['Zaokrąglanie dolnego odcinka pleców na dole','Kolana uciekające do środka','Odrywanie pięt'],alt:['goblet','bss'],
  fig:{ecc:'AB',hl:['thigh'],eq:[{t:'bar',at:'hand'}],
   A:{a:[0,4],hip:[0,89],t:89,hand:{sh:[-7,4]},es:1,h:90},
   B:{a:[0,4],hip:[-25,37],t:53,hand:{sh:[-7,4]},es:1,h:68}}},
 goblet:{n:'Przysiad goblet',en:'Goblet squat',p:'knee',kind:'db',inc:2,unitKg:'kg',m:{quads:1,glutes:0.5},
  cues:['Hantla trzymana pionowo przy mostku','Tułów wyprostowany, łokcie między kolanami na dole','Pełna głębokość bez odrywania pięt'],
  err:['Pochylanie tułowia i odsuwanie hantli od ciała','Zbyt płytkie zejście'],alt:['squat','bss'],
  fig:{ecc:'AB',hl:['thigh'],eq:[{t:'db',at:'hand',r:10}],
   A:{a:[0,4],hip:[0,89],t:90,hand:{sh:[12,-14]},es:-1,h:90},
   B:{a:[0,4],hip:[-20,32],t:68,hand:{sh:[14,-12]},es:-1,h:80}}},
 bss:{n:'Przysiad bułgarski',en:'Bulgarian split squat',p:'knee',kind:'db',inc:2,m:{quads:1,glutes:1},uni:true,
  cues:['Tylna stopa na ławce, przednia ok. pół metra przed nią','Schodź pionowo w dół, aż tylne kolano prawie dotknie podłogi','Ciężar na pięcie i śródstopiu przedniej nogi','Serie liczysz na każdą nogę'],
  err:['Za krótki krok: kolano daleko przed palcami i ból kolana','Odbijanie się tylną nogą'],alt:['lunge','goblet'],
  fig:{ecc:'AB',hl:['thigh'],eq:[{t:'bench',pts:[[-82,40],[-50,40]]},{t:'db',at:'hand'}],
   A:{a:[2,4],a2:[-60,46],ft2:-20,hip:[-16,86],t:88,hand:{sh:[1,-56]},ks2:1,h:90},
   B:{a:[2,4],a2:[-60,46],ft2:-20,hip:[-24,44],t:80,hand:{sh:[1,-56]},ks2:1,h:85}}},
 lunge:{n:'Wykroki z hantlami',en:'Dumbbell lunge',p:'knee',kind:'db',inc:2,m:{quads:1,glutes:1},uni:true,
  cues:['Długi krok, tułów pionowo','Tylne kolano schodzi prawie do podłogi','Odepchnij się przednią piętą do pozycji wyjściowej'],
  err:['Kolano przedniej nogi zapada się do środka','Krótki krok i odrywanie przedniej pięty'],alt:['bss','goblet'],
  fig:{ecc:'AB',hl:['thigh'],eq:[{t:'db',at:'hand'}],
   A:{a:[26,4],a2:[-44,9],ft2:-35,hip:[-8,82],t:90,hand:{sh:[1,-56]},ks2:1,h:90},
   B:{a:[26,4],a2:[-44,9],ft2:-35,hip:[-10,46],t:88,hand:{sh:[1,-56]},ks2:1,h:90}}},
 legext:{n:'Prostowanie nóg na maszynie',en:'Leg extension',p:'iso',kind:'machine',inc:5,m:{quads:1},
  cues:['Oś maszyny na wysokości kolana','Pełny wyprost i krótka pauza na górze','Opuszczaj powoli, do pełnego zgięcia'],
  err:['Wyrzucanie ciężaru z bujnięcia','Odrywanie bioder od siedziska'],alt:['goblet','bss'],
  fig:{ecc:'BA',hl:['thigh'],eq:[{t:'bench',pts:[[-14,40],[38,40]]},{t:'bench',pts:[[-14,40],[-24,100]],noLegs:true},{t:'pad',at:'ankle',dx:4}],
   A:{a:[37,6],hip:[0,48],t:100,hand:{hip:[16,-2]},legA:[2,-98],ft:-10,h:95},
   B:{a:[86,48],hip:[0,48],t:100,hand:{hip:[16,-2]},legA:[2,4],ft:80,h:95}}},
 deadlift:{n:'Martwy ciąg',en:'Deadlift',p:'hinge',kind:'bar',inc:5,m:{hams:1,glutes:1,back:0.5},
  cues:['Gryf nad środkiem stopy, blisko piszczeli','Plecy neutralne, łopatki nad gryfem','Pchaj podłogę nogami, biodra i barki wstają razem','Gryf prowadź przy nogach przez cały ruch'],
  err:['Zaokrąglone plecy przy starcie','Biodra wystrzeliwują w górę szybciej niż barki','Przeprost w lędźwiach na górze'],alt:['rdl'],
  fig:{ecc:'BA',hl:['thigh','torso'],eq:[{t:'bar',at:'hand'}],
   A:{a:[0,4],hip:[-38,52],t:32,hand:{sh:[4,-58]},h:50},
   B:{a:[0,4],hip:[0,89],t:90,hand:{sh:[3,-58]},h:90}}},
 rdl:{n:'Rumuński martwy ciąg',en:'Romanian deadlift',p:'hinge',kind:'bar',inc:2.5,m:{hams:1,glutes:1},
  cues:['Kolana lekko ugięte i nieruchome','Cofaj biodra, gryf zjeżdża po udach','Zatrzymaj się, gdy poczujesz mocne rozciągnięcie dwugłowych','Plecy neutralne przez cały ruch'],
  err:['Uginanie kolan jak w przysiadzie','Zaokrąglanie pleców, żeby zejść niżej'],alt:['deadlift','hipthrust'],
  fig:{ecc:'AB',hl:['thigh'],eq:[{t:'bar',at:'hand'}],
   A:{a:[0,4],hip:[0,89],t:90,hand:{sh:[3,-58]},h:90},
   B:{a:[0,4],hip:[-40,80],t:18,hand:{sh:[3,-58]},h:35}}},
 hipthrust:{n:'Hip thrust ze sztangą',en:'Barbell hip thrust',p:'hinge',kind:'bar',inc:5,m:{glutes:1,hams:0.5},
  cues:['Dolne łopatki oparte o krawędź ławki','Stopy tak, by na górze piszczele były pionowe','Na górze tułów i uda w jednej linii, broda przy klatce','Pauza 1 s z mocno napiętymi pośladkami'],
  err:['Przeprost lędźwi zamiast wyprostu bioder','Stopy za daleko: pracują dwugłowe zamiast pośladków'],alt:['rdl'],
  fig:{ecc:'BA',hl:['thigh'],eq:[{t:'bench',pts:[[-70,36],[-36,36]]},{t:'bar',at:'hip',dy:12}],
   A:{a:[42,4],sh:[-38,44],hip:[4,16],hand:{hip:[-4,9]},ks:1,h:150},
   B:{a:[42,4],sh:[-38,44],hip:[10,46],hand:{hip:[-4,9]},ks:1,h:150}}},
 legcurl:{n:'Uginanie nóg siedząc',en:'Seated leg curl',p:'iso',kind:'machine',inc:5,m:{hams:1},
  cues:['Wersja siedząca rozciąga dwugłowe mocniej niż leżąca','Udo dociśnięte wałkiem, oś maszyny przy kolanie','Pełne zgięcie, potem powolny powrót do wyprostu'],
  err:['Odrywanie bioder od siedziska','Skrócony zakres przy wyproście'],alt:['rdl'],
  fig:{ecc:'BA',hl:['thigh'],eq:[{t:'bench',pts:[[-14,40],[38,40]]},{t:'bench',pts:[[-14,40],[-24,100]],noLegs:true},{t:'pad',at:'knee',dy:10},{t:'pad',at:'ankle',dy:-5}],
   A:{a:[86,48],hip:[0,48],t:100,hand:{hip:[16,-2]},legA:[2,0],ft:80,h:95},
   B:{a:[26,12],hip:[0,48],t:100,hand:{hip:[16,-2]},legA:[2,-118],ft:-30,h:95}}},
 calf:{n:'Wspięcia na palce',en:'Standing calf raise',p:'iso',kind:'machine',inc:5,m:{calves:1},
  cues:['Przednia część stopy na krawędzi podwyższenia','Na dole pauza 1–2 s w pełnym rozciągnięciu','Wspinaj się maksymalnie wysoko, kolana proste'],
  err:['Sprężynowanie bez pauzy na dole','Krótki zakres ruchu'],alt:[],
  fig:{ecc:'BA',hl:['shin'],eq:[{t:'box',x:6,w:34,h:12},{t:'db',at:'hand'}],
   A:{a:[0,7],ft:24,hip:{a:[0,86]},t:90,hand:{sh:[1,-56]},h:90},
   B:{a:[4,22],ft:-50,hip:{a:[0,86]},t:90,hand:{sh:[1,-56]},h:90}}},
 bench:{n:'Wyciskanie sztangi leżąc',en:'Bench press',p:'hpush',kind:'bar',inc:2.5,m:{chest:1,triceps:0.5,delts:0.5},
  cues:['Łopatki ściągnięte i opuszczone, stopy mocno w podłodze','Chwyt nieco szerszy niż barki','Sztanga schodzi do dołu klatki w 2–3 s','Łokcie ok. 45–70° od tułowia'],
  err:['Odbijanie sztangi od klatki','Łokcie rozstawione na 90°','Odrywanie pośladków od ławki'],alt:['dbbench','pushup'],
  fig:{ecc:'AB',hl:['torso'],eq:[{t:'bench',pts:[[-78,46],[30,46]]},{t:'bar',at:'hand'}],
   A:{a:[64,4],hip:[18,54],t:180,hand:{sh:[0,58]},ks:1,h:180},
   B:{a:[64,4],hip:[18,54],t:180,hand:{sh:[14,12]},ks:1,es:-1,h:180}}},
 dbbench:{n:'Wyciskanie hantli leżąc',en:'Dumbbell bench press',p:'hpush',kind:'db',inc:2,m:{chest:1,triceps:0.5,delts:0.5},
  cues:['Hantle schodzą niżej niż sztanga, poczuj rozciągnięcie klatki','Nadgarstki nad łokciami','Na górze hantle zbliżają się do siebie bez stukania'],
  err:['Skracanie zakresu na dole','Opuszczanie hantli za głowę'],alt:['bench','pushup'],
  fig:{ecc:'AB',hl:['torso'],eq:[{t:'bench',pts:[[-78,46],[30,46]]},{t:'db',at:'hand'}],
   A:{a:[64,4],hip:[18,54],t:180,hand:{sh:[0,58]},ks:1,h:180},
   B:{a:[64,4],hip:[18,54],t:180,hand:{sh:[12,2]},ks:1,es:-1,h:180}}},
 incline:{n:'Wyciskanie hantli na skosie',en:'Incline dumbbell press',p:'hpush',kind:'db',inc:2,m:{chest:1,delts:0.5,triceps:0.5},
  cues:['Ławka ustawiona na 30–45°','Hantle schodzą do górnej części klatki','Wyciskaj w górę nad barki, nie do przodu'],
  err:['Zbyt strome oparcie: pracują głównie barki','Wyginanie lędźwi i odrywanie bioder'],alt:['dbbench','bench'],
  fig:{ecc:'AB',hl:['torso'],eq:[{t:'bench',pts:[[40,42],[6,42],[-34,74]]},{t:'db',at:'hand'}],
   A:{a:[66,4],hip:[16,50],t:145,hand:{sh:[6,57]},ks:1,h:150},
   B:{a:[66,4],hip:[16,50],t:145,hand:{sh:[16,6]},ks:1,es:-1,h:150}}},
 pushup:{n:'Pompki',en:'Push-up',p:'hpush',kind:'bw',inc:2.5,m:{chest:1,triceps:0.5,delts:0.5},
  cues:['Dłonie nieco szerzej niż barki','Ciało w jednej linii od głowy do pięt','Klatka schodzi prawie do podłogi','Gdy 15+ powtórzeń jest łatwe, dodaj obciążenie lub podnieś stopy'],
  err:['Opadające biodra','Łokcie rozstawione na boki'],alt:['dbbench','bench'],
  fig:{ecc:'AB',hl:['torso'],eq:[],
   A:{sh:[42,60],t:22,a:[-84,10],ft:-70,hand:[44,3],es:-1,h:20},
   B:{sh:[44,19],t:3,a:[-91,10],ft:-70,hand:[44,3],es:-1,h:5}}},
 dips:{n:'Pompki na poręczach',en:'Dips',p:'hpush',kind:'bw',inc:2.5,m:{chest:1,triceps:1},
  cues:['Pochyl tułów w przód, by mocniej pracowała klatka','Schodź, aż ramię będzie równoległe do podłogi','Barki nisko, z dala od uszu'],
  err:['Zbyt głębokie zejście przy bólu barku','Bujanie nogami'],alt:['pushup','pushdown'],
  fig:{ecc:'AB',hl:['torso','ua'],eq:[{t:'dip',y:95,x1:-30,x2:30}],
   A:{hand:[0,95],sh:[-3,152],t:72,a:{hip:[-22,-70]},ks:1,ft:-60,es:-1,h:78},
   B:{hand:[0,95],sh:[12,114],t:58,a:{hip:[-24,-68]},ks:1,ft:-60,es:-1,h:66}}},
 ohp:{n:'Wyciskanie żołnierskie',en:'Overhead press',p:'vpush',kind:'bar',inc:2.5,m:{delts:1,triceps:0.5},
  cues:['Napięte pośladki i brzuch, nogi proste','Sztanga startuje z górnej części klatki','Głowa lekko w tył, potem wsuń ją pod gryf','Na górze gryf nad środkiem stopy'],
  err:['Mocne odchylanie tułowia w tył','Wypychanie sztangi do przodu'],alt:['incline'],
  fig:{ecc:'BA',hl:['ua'],eq:[{t:'bar',at:'hand'}],
   A:{a:[0,4],hip:[0,89],t:90,hand:{sh:[12,4]},es:-1,h:96},
   B:{a:[0,4],hip:[0,89],t:91,hand:{sh:[1,57]},es:-1,h:90}}},
 latraise:{n:'Unoszenie hantli bokiem',en:'Lateral raise',p:'iso',kind:'db',inc:1,m:{delts:1},
  cues:['Lekko ugięte łokcie, prowadzisz ruch łokciem','Unoś do wysokości barków','Opuszczaj powoli, 2–3 s','Lekki ciężar, 12–20 powtórzeń'],
  err:['Zarzucanie hantli tułowiem','Podnoszenie barków do uszu'],alt:[],
  fig:{front:1,ecc:'BA',hl:['ua'],eq:[{t:'db',at:'hand',r:6},{t:'db',at:'hand2',r:6}],
   A:{a:[9,4],hip:[0,89],t:90,armA:[-82,-86],h:90},
   B:{a:[9,4],hip:[0,89],t:90,armA:[2,-4],h:90}}},
 facepull:{n:'Face pull',en:'Cable face pull',p:'hpull',kind:'cable',inc:2.5,m:{delts:0.5,back:0.5},
  cues:['Wyciąg na wysokości twarzy, lina chwytem nachwytem','Ciągnij do czoła, łokcie wysoko i szeroko','Na końcu rotacja zewnętrzna: dłonie za uszy'],
  err:['Ciągnięcie do brzucha','Odchylanie tułowia zamiast pracy barków'],alt:['latraise'],
  fig:{ecc:'BA',hl:['ua'],eq:[{t:'cable',from:[96,150]}],
   A:{a:[0,4],hip:[0,89],t:94,hand:{sh:[54,6]},es:1,h:90},
   B:{a:[0,4],hip:[0,89],t:96,hand:{sh:[8,16]},es:1,h:90}}},
 row:{n:'Wiosłowanie sztangą w opadzie',en:'Barbell row',p:'hpull',kind:'bar',inc:2.5,m:{back:1,biceps:0.5},
  cues:['Tułów pochylony ok. 30–45°, plecy neutralne','Przyciągaj gryf do dołu brzucha','Ściągnij łopatki na górze, opuszczaj z kontrolą'],
  err:['Prostowanie tułowia przy każdym powtórzeniu','Zaokrąglone plecy'],alt:['dbrow','cablerow'],
  fig:{ecc:'BA',hl:['torso','ua'],eq:[{t:'bar',at:'hand'}],
   A:{a:[0,4],hip:[-32,78],t:30,hand:{sh:[3,-57]},h:20},
   B:{a:[0,4],hip:[-32,78],t:32,hand:{sh:[-12,-26]},es:-1,h:20}}},
 dbrow:{n:'Wiosłowanie hantlem',en:'One-arm dumbbell row',p:'hpull',kind:'db',inc:2,m:{back:1,biceps:0.5},uni:true,
  cues:['Wolna ręka oparta o ławkę, plecy równolegle do podłogi','Pełne rozciągnięcie na dole','Prowadź łokieć do biodra, nie w górę do barku'],
  err:['Rotacja tułowia przy ciągnięciu','Szarpanie ciężarem'],alt:['row','cablerow'],
  fig:{ecc:'BA',hl:['torso','ua'],eq:[{t:'bench',pts:[[48,52],[104,52]]},{t:'db',at:'hand'}],
   A:{a:[-12,4],a2:[-34,4],hip:[-22,84],t:8,hand:{sh:[1,-50]},hand2:{sh:[34,-36]},es2:1,h:5},
   B:{a:[-12,4],a2:[-34,4],hip:[-22,84],t:10,hand:{sh:[-20,-12]},hand2:{sh:[34,-36]},es:-1,es2:1,h:5}}},
 cablerow:{n:'Wiosłowanie siedząc wyciągiem',en:'Seated cable row',p:'hpull',kind:'cable',inc:2.5,m:{back:1,biceps:0.5},
  cues:['Lekkie pochylenie w przód na starcie, by rozciągnąć plecy','Przyciągaj uchwyt do brzucha, łokcie wzdłuż tułowia','Tułów wraca do pionu, bez odchylania w tył'],
  err:['Ciągnięcie samymi rękami','Mocne bujanie tułowiem'],alt:['dbrow','row'],
  fig:{ecc:'BA',hl:['torso','ua'],eq:[{t:'bench',pts:[[-24,18],[24,18]]},{t:'plate',x:80,y1:6,y2:42},{t:'cable',from:[118,28]}],
   A:{a:[72,24],hip:[0,24],t:72,hand:{sh:[52,-10]},ks:1,ft:85,h:60},
   B:{a:[72,24],hip:[0,24],t:96,hand:{sh:[6,-30]},ks:1,ft:85,es:-1,h:90}}},
 pullup:{n:'Podciąganie na drążku',en:'Pull-up / chin-up',p:'vpull',kind:'bw',inc:2.5,m:{back:1,biceps:0.5},
  cues:['Zacznij z pełnego zwisu','Ściągnij łopatki w dół i ciągnij łokcie do żeber','Broda nad drążek, opuszczanie 2–3 s','Gdy robisz górę zakresu, dodaj obciążenie na pasie'],
  err:['Półpowtórzenia bez pełnego zwisu','Wymachy nogami'],alt:['latpull'],
  fig:{ecc:'BA',hl:['ua','torso'],eq:[{t:'pullbar',at:[0,0]}],
   A:{hand:[0,0],sh:[-3,-57],t:93,a:{hip:[-4,-84]},ks:1,ft:-60,es:-1,h:92},
   B:{hand:[0,0],sh:[-6,-12],t:102,a:{hip:[-8,-82]},ks:1,ft:-60,es:-1,h:96}}},
 latpull:{n:'Ściąganie drążka wyciągu',en:'Lat pulldown',p:'vpull',kind:'cable',inc:2.5,m:{back:1,biceps:0.5},
  cues:['Uda zablokowane pod wałkiem','Lekkie odchylenie tułowia, klatka do góry','Ściągaj drążek do górnej części klatki','Pełny wyprost rąk na górze'],
  err:['Ściąganie za głowę','Mocne bujanie tułowiem'],alt:['pullup'],
  fig:{ecc:'BA',hl:['ua','torso'],eq:[{t:'bench',pts:[[-20,38],[22,38]]},{t:'pad',at:[44,58]},{t:'cable',from:[10,190]}],
   A:{a:[48,4],hip:[0,44],t:98,hand:{sh:[6,57]},ks:1,es:-1,h:95},
   B:{a:[48,4],hip:[0,44],t:104,hand:{sh:[12,6]},ks:1,es:-1,h:95}}},
 curl:{n:'Uginanie ramion z hantlami',en:'Dumbbell curl',p:'iso',kind:'db',inc:1,m:{biceps:1},
  cues:['Łokcie przy tułowiu i nieruchome','Pełny wyprost na dole','Supinuj nadgarstek w trakcie ruchu'],
  err:['Bujanie tułowiem','Wysuwanie łokci do przodu na górze'],alt:[],
  fig:{ecc:'BA',hl:['fa'],eq:[{t:'db',at:'hand'}],
   A:{a:[0,4],hip:[0,89],t:90,armA:[-90,-88],h:90},
   B:{a:[0,4],hip:[0,89],t:90,armA:[-86,78],h:90}}},
 triext:{n:'Wyprost ramion nad głową',en:'Overhead triceps extension',p:'iso',kind:'db',inc:2,m:{triceps:1},
  cues:['Ramiona przy głowie, łokcie skierowane w górę','Opuść hantlę głęboko za głowę','Ta pozycja mocno rozciąga długą głowę tricepsa'],
  err:['Rozchodzące się łokcie','Wyginanie lędźwi'],alt:['pushdown'],
  fig:{ecc:'AB',hl:['ua'],eq:[{t:'db',at:'hand',r:9}],
   A:{a:[0,4],hip:[0,89],t:90,armA:[96,92],h:90},
   B:{a:[0,4],hip:[0,89],t:90,armA:[100,-105],h:90}}},
 pushdown:{n:'Prostowanie ramion na wyciągu',en:'Triceps pushdown',p:'iso',kind:'cable',inc:2.5,m:{triceps:1},
  cues:['Łokcie przyklejone do boków','Pełny wyprost na dole','Wracaj, aż przedramię minie poziom'],
  err:['Pomaganie sobie barkami i tułowiem','Łokcie wędrujące do przodu'],alt:['triext'],
  fig:{ecc:'BA',hl:['fa'],eq:[{t:'cable',from:[18,186]}],
   A:{a:[0,4],hip:[0,89],t:84,armA:[-96,22],h:80},
   B:{a:[0,4],hip:[0,89],t:84,armA:[-94,-90],h:80}}},
 plank:{n:'Deska',en:'Plank',p:'core',kind:'bw',inc:2.5,unit:'s',m:{abs:1},
  cues:['Łokcie pod barkami','Napnij pośladki i brzuch, miednica lekko podwinięta','Ciało w jednej linii, oddychaj spokojnie'],
  err:['Opadające biodra','Biodra wysoko w górze'],alt:['hangleg'],
  fig:{ecc:'AB',static:1,hl:['torso'],eq:[],
   A:{sh:[40,31],t:4,a:[-93,13],ft:-70,hand:[68,3],es:-1,h:0},
   B:{sh:[40,32],t:3,a:[-93,13],ft:-70,hand:[68,3],es:-1,h:0}}},
 hangleg:{n:'Unoszenie nóg w zwisie',en:'Hanging leg raise',p:'core',kind:'bw',inc:2.5,m:{abs:1},
  cues:['Zwis na prostych rękach, barki aktywne','Podwiń miednicę i unieś kolana co najmniej do bioder','Opuszczaj powoli, bez wymachu'],
  err:['Bujanie całym ciałem','Unoszenie nóg bez podwinięcia miednicy'],alt:['plank'],
  fig:{ecc:'BA',hl:['torso','thigh'],eq:[{t:'pullbar',at:[0,0]}],
   A:{hand:[0,0],sh:[-2,-57],t:92,a:{hip:[-2,-86]},ks:1,ft:-60,h:92},
   B:{hand:[0,0],sh:[-6,-58],t:96,a:{hip:[38,-24]},ks:1,ft:-60,h:90}}},
 farmer:{n:'Spacer farmera',en:"Farmer's walk",p:'core',kind:'db',inc:2,unit:'s',m:{abs:0.5},
  cues:['Ciężkie hantle w obu rękach, barki ściągnięte','Krótkie, szybkie kroki, tułów pionowo','Licz czas spaceru albo dystans'],
  err:['Pochylanie się na boki','Zaokrąglone plecy'],alt:['plank'],
  fig:{ecc:'AB',hl:['torso'],eq:[{t:'db',at:'hand'}],walk:1,
   A:{a:[16,4],a2:[-18,8],ft2:-25,hip:[0,85],t:90,hand:{sh:[1,-56]},ks2:1,h:90},
   B:{a:[-18,8],a2:[16,4],ft:-25,hip:[0,85],t:90,hand:{sh:[1,-56]},ks:1,h:90}}}
};
const x=(id,sets,lo,hi,rest)=>({id,sets,lo,hi,rest});
const PLANS={
 fbw2:{name:'FBW 2×',long:'Całe ciało · 2 dni w tygodniu',level:'Mało czasu',when:'Np. wt i pt, co najmniej 2 dni przerwy',perWeek:2,days:[
  {name:'Trening A',ex:[x('squat',4,6,10,180),x('bench',4,6,10,180),x('latpull',4,8,12,120),x('rdl',3,8,12,150),x('latraise',3,12,20,60),x('curl',2,10,15,60),x('hangleg',2,8,15,60)]},
  {name:'Trening B',ex:[x('deadlift',3,5,8,180),x('incline',4,8,12,120),x('cablerow',4,8,12,120),x('bss',3,8,12,90),x('ohp',3,6,10,150),x('triext',3,10,15,60),x('plank',2,30,60,60)]}]},
 fbw3:{name:'FBW 3×',long:'Całe ciało · 3 dni w tygodniu',level:'Początkujący',when:'Np. pn / śr / pt, treningi A, B, C po kolei',perWeek:3,days:[
  {name:'Trening A',ex:[x('squat',3,6,10,180),x('bench',3,6,10,150),x('latpull',3,8,12,120),x('rdl',3,8,12,150),x('latraise',3,12,20,60),x('curl',2,10,15,60)]},
  {name:'Trening B',ex:[x('deadlift',3,5,8,180),x('incline',3,8,12,120),x('cablerow',3,8,12,120),x('bss',3,8,12,90),x('triext',3,10,15,60),x('plank',2,30,60,60)]},
  {name:'Trening C',ex:[x('squat',3,8,12,150),x('ohp',3,6,10,150),x('pullup',3,5,10,150),x('dbbench',3,8,12,120),x('legcurl',3,10,15,90),x('facepull',2,12,20,60),x('calf',3,10,15,60)]}]},
 ul4:{name:'Góra / Dół',long:'Upper / Lower · 4 dni w tygodniu',level:'Średniozaawansowany',when:'Np. pn / wt / czw / pt',perWeek:4,days:[
  {name:'Góra A',ex:[x('bench',4,6,8,180),x('row',4,6,10,150),x('ohp',3,6,10,150),x('latpull',3,8,12,120),x('latraise',3,12,20,60),x('curl',2,10,15,60),x('triext',2,10,15,60)]},
  {name:'Dół A',ex:[x('squat',4,6,8,180),x('rdl',3,8,10,150),x('bss',3,8,12,90),x('legcurl',3,10,15,90),x('calf',4,10,15,60),x('plank',3,30,60,60)]},
  {name:'Góra B',ex:[x('incline',4,8,12,120),x('pullup',4,6,10,150),x('dips',3,8,12,120),x('cablerow',3,10,12,120),x('latraise',3,12,20,60),x('facepull',2,12,20,60),x('curl',2,10,15,60),x('pushdown',2,10,15,60)]},
  {name:'Dół B',ex:[x('deadlift',3,4,6,180),x('hipthrust',3,8,12,120),x('lunge',3,10,12,90),x('legext',3,12,15,90),x('calf',4,10,15,60),x('hangleg',3,8,15,60)]}]},
 ppl5:{name:'Góra/Dół + PPL',long:'Upper / Lower + Push / Pull / Legs · 5 dni',level:'Zaawansowany',when:'Np. pn / wt / czw / pt / sob',perWeek:5,days:[
  {name:'Góra',ex:[x('bench',4,6,8,180),x('row',4,6,10,150),x('ohp',3,6,10,150),x('latpull',3,8,12,120),x('curl',2,10,15,60),x('triext',2,10,15,60)]},
  {name:'Dół',ex:[x('squat',4,6,8,180),x('rdl',3,8,10,150),x('legcurl',3,10,15,90),x('calf',4,10,15,60),x('plank',3,30,60,60)]},
  {name:'Push',ex:[x('incline',4,8,12,120),x('dips',3,8,12,120),x('dbbench',2,10,12,120),x('latraise',4,12,20,60),x('pushdown',3,10,15,60)]},
  {name:'Pull',ex:[x('pullup',4,6,10,150),x('cablerow',3,10,12,120),x('dbrow',2,10,12,90),x('facepull',3,12,20,60),x('curl',3,10,15,60),x('hangleg',3,8,15,60)]},
  {name:'Nogi',ex:[x('deadlift',3,4,6,180),x('hipthrust',3,8,12,120),x('bss',3,8,12,90),x('legext',3,12,15,90),x('calf',4,10,15,60),x('farmer',3,30,45,90)]}]}
};
/* 6-week mesocycle: effort rises, week 6 is a deload */
const CYCLE=[{rir:'3',txt:'Wejście: zostaw 3 powtórzenia w zapasie'},{rir:'2–3',txt:'Zostaw 2–3 powtórzenia w zapasie'},{rir:'2',txt:'Zostaw 2 powtórzenia w zapasie'},{rir:'1–2',txt:'Zostaw 1–2 powtórzenia w zapasie'},{rir:'0–1',txt:'Najcięższy tydzień: 0–1 w zapasie, w izolacjach możesz dojść do upadku'},{rir:'3–4',deload:true,txt:'Tydzień lżejszy: połowa serii, ok. 10% mniej ciężaru, duży zapas'}];

/* ---------- Machines, cables, dumbbells ---------- */
const SEAT=[{t:'bench',pts:[[-18,40],[22,40]]},{t:'bench',pts:[[-18,40],[-26,104]],noLegs:true}];
const CURLA={a:[0,4],hip:[0,89],t:90,armA:[-90,-88],h:90},CURLB={a:[0,4],hip:[0,89],t:90,armA:[-86,78],h:90};
const FRONT_SEAT=[{t:'rect',x:-24,y:44,w:48,h:72},{t:'rect',x:-22,y:36,w:44,h:8},{t:'rail',from:[0,0],to:[0,36],w:6}];
Object.assign(EX,{
 legpress:{n:'Suwnica (leg press 45°)',en:'Leg press',p:'knee',kind:'machine',inc:10,m:{quads:1,glutes:0.5},
  cues:['Plecy i pośladki dociśnięte do oparcia przez cały ruch','Stopy na środku platformy, na szerokość bioder','Opuszczaj, aż kolana zbliżą się do klatki, bez podwijania miednicy','Nie blokuj kolan na górze'],
  err:['Odrywanie pośladków od oparcia na dole','Zbyt płytki ruch z bardzo dużym ciężarem','Zapadanie się kolan do środka'],alt:['hack','squat','goblet'],
  fig:{ecc:'AB',eq:[{t:'rail',from:[44,44],to:[104,96],w:3},{t:'bench',pts:[[16,24],[-8,24]]},{t:'backpad',o:15},{t:'platform',at:'ankle',ang:130,len:44,off:[4,3]}],
   A:{hip:[0,32],t:140,a:[62,84],ks:1,ft:130,hand:{hip:[12,-2]},h:122},
   B:{hip:[0,32],t:140,a:[30,58],ks:1,ft:130,hand:{hip:[12,-2]},h:122}}},
 hack:{n:'Przysiad na maszynie hack',en:'Hack squat',p:'knee',kind:'machine',inc:10,m:{quads:1,glutes:0.5},
  cues:['Plecy całą długością na oparciu, barki pod poduszkami','Stopy na środku platformy, pięty dociśnięte','Schodź głęboko, aż uda będą co najmniej równoległe','Nie blokuj kolan na górze'],
  err:['Odrywanie pięt','Płytkie powtórzenia'],alt:['squat','legpress'],
  fig:{ecc:'AB',eq:[{t:'rail',from:[10,3],to:[58,13],w:5},{t:'backpad',o:15},{t:'pad',at:'sh',dx:-2,dy:7}],
   A:{a:[30,8],ft:12,hip:[-4,90],t:104,hand:{sh:[6,8]},es:-1,h:96},
   B:{a:[30,8],ft:12,hip:[8,44],t:104,hand:{sh:[6,8]},es:-1,h:96}}},
 chestpress:{n:'Wyciskanie na maszynie siedząc',en:'Machine chest press',p:'hpush',kind:'machine',inc:5,m:{chest:1,triceps:0.5,delts:0.5},
  cues:['Uchwyty na wysokości środka klatki','Łopatki ściągnięte i przyklejone do oparcia','Wypychaj przed siebie bez blokowania łokci','Wracaj powoli, aż poczujesz rozciągnięcie klatki'],
  err:['Odrywanie pleców od oparcia','Za wysoko ustawione siedzisko: pracują barki'],alt:['bench','dbbench','pecdeck'],
  fig:{ecc:'BA',eq:SEAT.concat([{t:'lever',from:[60,150]},{t:'grip'}]),
   A:{a:[34,4],hip:[0,46],t:96,hand:{sh:[14,-4]},es:-1,h:92},
   B:{a:[34,4],hip:[0,46],t:96,hand:{sh:[56,-2]},es:-1,h:92}}},
 pecdeck:{n:'Rozpiętki na maszynie',en:'Pec deck / butterfly',p:'iso',kind:'machine',inc:5,m:{chest:1},
  cues:['Uchwyty na wysokości klatki, łokcie lekko ugięte','Prowadź ręce po łuku, jakbyś obejmował beczkę','Wracaj szeroko, do mocnego rozciągnięcia klatki'],
  err:['Pchanie dłońmi zamiast pracy z barku','Zbyt duży ciężar i skrócony powrót'],alt:['cablefly','chestpress'],
  fig:{front:1,ecc:'BA',eq:FRONT_SEAT.concat([{t:'grip',at:'hand'},{t:'grip',at:'hand2'}]),
   A:{a:[9,4],hip:[0,48],t:90,seatF:1,armA:[6,4],h:90},
   B:{a:[9,4],hip:[0,48],t:90,seatF:1,armA:[-28,182],h:90}}},
 revpec:{n:'Odwrotne rozpiętki na maszynie',en:'Reverse pec deck',p:'iso',kind:'machine',inc:5,m:{delts:1,back:0.5},
  cues:['Klatka przy oparciu, uchwyty na wysokości barków','Rozkładaj ręce szeroko, aż dłonie będą w linii barków','Ruch z tylnych barków, nie z ściągania łopatek'],
  err:['Szarpanie ciężarem','Za duży ciężar i krótki ruch'],alt:['facepull'],
  fig:{front:1,ecc:'BA',eq:FRONT_SEAT.concat([{t:'grip',at:'hand'},{t:'grip',at:'hand2'}]),
   A:{a:[9,4],hip:[0,48],t:90,seatF:1,armA:[-10,185],h:90},
   B:{a:[9,4],hip:[0,48],t:90,seatF:1,armA:[4,2],h:90}}},
 machpress:{n:'Wyciskanie nad głowę na maszynie',en:'Machine shoulder press',p:'vpush',kind:'machine',inc:5,m:{delts:1,triceps:0.5},
  cues:['Uchwyty na wysokości barków','Plecy przy oparciu, brzuch napięty','Wypychaj pionowo, bez pełnego blokowania łokci'],
  err:['Odrywanie pleców od oparcia','Za nisko ustawione siedzisko'],alt:['ohp','dbohp'],
  fig:{ecc:'BA',eq:SEAT.concat([{t:'lever',from:[-30,140]},{t:'grip'}]),
   A:{a:[34,4],hip:[0,46],t:94,hand:{sh:[12,4]},es:-1,h:92},
   B:{a:[34,4],hip:[0,46],t:94,hand:{sh:[4,57]},es:-1,h:92}}},
 machinerow:{n:'Wiosłowanie na maszynie',en:'Chest-supported machine row',p:'hpull',kind:'machine',inc:5,m:{back:1,biceps:0.5},
  cues:['Klatka oparta o poduszkę przez cały ruch','Ciągnij łokcie w tył, wzdłuż tułowia','Na końcu ściśnij łopatki, wracaj do pełnego wyprostu rąk'],
  err:['Odchylanie się od poduszki','Skrócony powrót'],alt:['row','dbrow','cablerow'],
  fig:{ecc:'BA',eq:[{t:'bench',pts:[[-16,40],[20,40]]},{t:'bench',pts:[[24,62],[28,100]],noLegs:true},{t:'lever',from:[78,110]},{t:'grip'}],
   A:{a:[36,4],hip:[0,46],t:84,hand:{sh:[52,-8]},es:-1,h:86},
   B:{a:[36,4],hip:[0,46],t:84,hand:{sh:[2,-10]},es:-1,h:86}}},
 lyingcurl:{n:'Uginanie nóg leżąc',en:'Lying leg curl',p:'iso',kind:'machine',inc:5,m:{hams:1},
  cues:['Biodra dociśnięte do ławki','Kolana tuż za krawędzią ławki, wałek nad piętami','Zegnij nogi maksymalnie, wracaj powoli do pełnego wyprostu'],
  err:['Unoszenie bioder','Rzucanie ciężarem w dół'],alt:['legcurl','rdl'],
  fig:{ecc:'BA',eq:[{t:'bench',pts:[[-36,35],[62,35]]},{t:'pad',at:'ankle',dx:0,dy:7}],
   A:{hip:[0,42],t:2,legA:[180,180],ft:-90,hand:{sh:[14,-24]},es:1,h:-6},
   B:{hip:[0,42],t:2,legA:[180,70],ft:-20,hand:{sh:[14,-24]},es:1,h:-6}}},
 seatedcalf:{n:'Wspięcia siedząc',en:'Seated calf raise',p:'iso',kind:'machine',inc:5,m:{calves:1},
  cues:['Wałek na udach tuż nad kolanami','Pięty jak najniżej, pauza 1–2 s','Wspinaj się maksymalnie wysoko'],
  err:['Krótkie sprężynowanie','Pomaganie sobie rękami'],alt:['calf'],
  fig:{ecc:'BA',eq:[{t:'bench',pts:[[-16,40],[22,40]]},{t:'box',x:40,w:30,h:10},{t:'pad',at:'knee',dx:-4,dy:9}],
   A:{hip:[0,46],t:92,legA:[0,-96],ft:30,hand:{hip:[20,6]},h:92},
   B:{hip:[0,46],t:92,legA:[8,-88],ft:0,hand:{hip:[20,6]},h:92}}},
 cablefly:{n:'Rozpiętki na wyciągu',en:'Cable crossover',p:'iso',kind:'cable',inc:2.5,m:{chest:1},
  cues:['Krok w przód, lekkie pochylenie, łokcie lekko ugięte','Prowadź dłonie po łuku w dół i do środka','Wracaj szeroko, do rozciągnięcia klatki'],
  err:['Uginanie łokci i wyciskanie zamiast rozpiętek','Pochylanie się mocno w przód'],alt:['pecdeck','dbbench'],
  fig:{front:1,ecc:'BA',eq:[{t:'cable',from:[78,176]},{t:'cable',from:[-78,176],at:'hand2'}],
   A:{a:[10,4],hip:[0,88],t:90,armA:[24,14],h:90},
   B:{a:[10,4],hip:[0,88],t:90,armA:[-112,-98],h:90}}},
 cablecurl:{n:'Uginanie ramion na wyciągu',en:'Cable curl',p:'iso',kind:'cable',inc:2.5,m:{biceps:1},
  cues:['Stań przodem do dolnego wyciągu','Łokcie przy tułowiu i nieruchome','Pełny wyprost na dole, wyciąg trzyma napięcie przez cały ruch'],
  err:['Bujanie tułowiem','Łokcie wędrują do przodu'],alt:['curl','hammer','inclinecurl'],
  fig:{ecc:'BA',eq:[{t:'cable',from:[40,8]}],A:CURLA,B:CURLB}},
 ropeoh:{n:'Wyprost ramion nad głową z liną',en:'Cable overhead triceps extension',p:'iso',kind:'cable',inc:2.5,m:{triceps:1},
  cues:['Tyłem do wyciągu, krok w przód, lekkie pochylenie','Łokcie przy głowie i nieruchome','Pełny wyprost w przód i powolny powrót za głowę'],
  err:['Łokcie opadają i pracują barki','Wyginanie lędźwi'],alt:['triext','skull','pushdown'],
  fig:{ecc:'BA',eq:[{t:'cable',from:[-46,190]}],
   A:{a:[16,4],a2:[-18,4],hip:[0,84],t:72,ks2:1,armA:[78,-100],h:62},
   B:{a:[16,4],a2:[-18,4],hip:[0,84],t:72,ks2:1,armA:[72,64],h:62}}},
 cablelat:{n:'Unoszenie bokiem na wyciągu',en:'Cable lateral raise',p:'iso',kind:'cable',inc:2.5,m:{delts:1},
  cues:['Bokiem do dolnego wyciągu, linka przed ciałem','Unoś do wysokości barku, prowadząc łokciem','Opuszczaj powoli, wyciąg trzyma napięcie na dole'],
  err:['Odchylanie tułowia od wyciągu','Unoszenie powyżej barków'],alt:['latraise'],
  fig:{front:1,ecc:'BA',eq:[{t:'cable',from:[-44,8]}],
   A:{a:[9,4],hip:[0,89],t:90,armA:[-112,-100],armA2:[-150,-120],h:90},
   B:{a:[9,4],hip:[0,89],t:90,armA:[4,0],armA2:[-150,-120],h:90}}},
 cablecrunch:{n:'Spięcia brzucha na wyciągu',en:'Cable crunch',p:'core',kind:'cable',inc:2.5,m:{abs:1},
  cues:['Klęk przodem do wyciągu, lina przy głowie','Biodra nieruchomo, zwijaj tułów: żebra do miednicy','Wydech na dole, powolny powrót'],
  err:['Siadanie na piętach zamiast zwijania tułowia','Ciągnięcie liny rękami'],alt:['hangleg','plank'],
  fig:{ecc:'BA',eq:[{t:'cable',from:[30,180]}],
   A:{legA:[-90,180],hip:[0,48],t:84,hand:{sh:[10,12]},es:-1,ft:-95,h:80},
   B:{legA:[-90,180],hip:[0,48],t:12,curve:12,hand:{sh:[14,8]},es:-1,ft:-95,h:-20}}},
 straightpd:{n:'Ściąganie prostych rąk na wyciągu',en:'Straight-arm pulldown',p:'vpull',kind:'cable',inc:2.5,m:{back:1},
  cues:['Lekki skłon w biodrach, plecy proste','Ręce prawie proste, ruch tylko w barkach','Ściągaj drążek po łuku do ud, poczuj najszersze'],
  err:['Uginanie łokci i ruch jak przy prostowaniu ramion','Zaokrąglanie pleców'],alt:['latpull','pullup'],
  fig:{ecc:'BA',eq:[{t:'cable',from:[86,186]}],
   A:{a:[0,4],hip:[0,88],t:72,armA:[50,46],h:62},
   B:{a:[0,4],hip:[0,88],t:72,armA:[-84,-86],h:62}}},
 dbohp:{n:'Wyciskanie hantli siedząc',en:'Seated dumbbell press',p:'vpush',kind:'db',inc:2,m:{delts:1,triceps:0.5},
  cues:['Oparcie ustawione pionowo lub prawie pionowo','Hantle startują na wysokości barków','Wyciskaj w górę, hantle zbliżają się nad głową'],
  err:['Odchylanie się i wyginanie lędźwi','Zbyt płytkie opuszczanie'],alt:['ohp','machpress'],
  fig:{ecc:'BA',eq:SEAT.concat([{t:'db',at:'hand'}]),
   A:{a:[34,4],hip:[0,46],t:92,hand:{sh:[10,4]},es:-1,h:92},
   B:{a:[34,4],hip:[0,46],t:92,hand:{sh:[3,57]},es:-1,h:92}}},
 hammer:{n:'Uginanie młotkowe',en:'Hammer curl',p:'iso',kind:'db',inc:1,m:{biceps:1},
  cues:['Chwyt neutralny: kciuki w górę','Łokcie przy tułowiu','Pracuje też mięsień ramienny i ramienno-promieniowy'],
  err:['Bujanie tułowiem','Wysuwanie łokci do przodu'],alt:['curl','cablecurl'],
  fig:{ecc:'BA',eq:[{t:'db',at:'hand',r:7}],A:CURLA,B:CURLB}},
 inclinecurl:{n:'Uginanie na ławce skośnej',en:'Incline dumbbell curl',p:'iso',kind:'db',inc:1,m:{biceps:1},
  cues:['Oparcie ok. 45–60°, ręce zwisają za linią tułowia','Ramię pionowo i nieruchomo','Ta pozycja mocno rozciąga biceps, zacznij od lżejszych hantli'],
  err:['Łokcie wędrują do przodu','Odrywanie barków od oparcia'],alt:['curl','cablecurl'],
  fig:{ecc:'BA',eq:[{t:'bench',pts:[[34,40],[4,40],[-28,80]]},{t:'db',at:'hand'}],
   A:{a:[56,4],hip:[12,46],t:128,ks:1,armA:[-92,-90],h:110},
   B:{a:[56,4],hip:[12,46],t:128,ks:1,armA:[-94,72],h:110}}},
 dbrdl:{n:'Rumuński martwy ciąg z hantlami',en:'Dumbbell Romanian deadlift',p:'hinge',kind:'db',inc:2,m:{hams:1,glutes:1},
  cues:['Hantle przy udach, kolana lekko ugięte','Cofaj biodra, hantle zjeżdżają blisko nóg','Zatrzymaj się przy mocnym rozciągnięciu dwugłowych','Plecy proste przez cały ruch'],
  err:['Zaokrąglanie pleców','Uginanie kolan jak w przysiadzie'],alt:['rdl','deadlift'],
  fig:{ecc:'AB',eq:[{t:'db',at:'hand'}],
   A:{a:[0,4],hip:[0,89],t:90,hand:{sh:[3,-58]},h:90},
   B:{a:[0,4],hip:[-40,80],t:18,hand:{sh:[3,-58]},h:35}}},
 stepup:{n:'Wejścia na skrzynię',en:'Dumbbell step-up',p:'knee',kind:'db',inc:2,m:{quads:1,glutes:1},uni:true,
  cues:['Cała stopa na skrzyni, kolano nad stopą','Wstań, pchając przednią piętą','Tylna noga tylko towarzyszy, nie odbijaj się','Schodź powoli tą samą drogą'],
  err:['Odbijanie się tylną nogą','Za wysoka skrzynia i zaokrąglone plecy'],alt:['bss','lunge'],
  fig:{ecc:'BA',eq:[{t:'box',x:6,w:46,h:40},{t:'db',at:'hand'}],
   A:{a:[26,44],a2:[-18,4],hip:[-8,84],t:80,hand:{sh:[1,-56]},ks:1,ks2:1,h:85},
   B:{a:[26,44],a2:[18,52],hip:[22,128],t:88,hand:{sh:[1,-56]},ks:1,ks2:1,ft2:-40,h:90}}},
 skull:{n:'Wyciskanie francuskie hantli leżąc',en:'Dumbbell skull crusher',p:'iso',kind:'db',inc:1,m:{triceps:1},
  cues:['Ramiona lekko odchylone w stronę głowy','Opuszczaj hantle za głowę, łokcie zostają w miejscu','Pełny wyprost na górze'],
  err:['Łokcie rozchodzą się na boki','Ramiona wędrują i ruch zamienia się w wyciskanie'],alt:['triext','ropeoh'],
  fig:{ecc:'AB',eq:[{t:'bench',pts:[[-78,46],[30,46]]},{t:'db',at:'hand',r:7}],
   A:{a:[64,4],hip:[18,54],t:180,ks:1,armA:[98,96],h:180},
   B:{a:[64,4],hip:[18,54],t:180,ks:1,armA:[102,194],h:180}}}
});
/* cross-links to the new variants */
Object.entries({squat:['goblet','bss','hack','legpress'],goblet:['squat','legpress','hack'],bss:['lunge','stepup','legpress'],lunge:['bss','stepup'],legext:['legpress','hack'],
 deadlift:['rdl','dbrdl'],rdl:['dbrdl','deadlift','hipthrust'],legcurl:['lyingcurl','rdl'],calf:['seatedcalf'],bench:['dbbench','chestpress','pushup'],dbbench:['bench','chestpress','pushup'],
 incline:['dbbench','chestpress'],pushup:['dbbench','chestpress'],dips:['pushup','chestpress','pushdown'],ohp:['dbohp','machpress'],latraise:['cablelat'],facepull:['revpec'],
 row:['dbrow','machinerow','cablerow'],dbrow:['row','machinerow','cablerow'],cablerow:['machinerow','dbrow'],pullup:['latpull','straightpd'],latpull:['pullup','straightpd'],
 curl:['hammer','cablecurl','inclinecurl'],triext:['ropeoh','skull','pushdown'],pushdown:['ropeoh','triext'],plank:['cablecrunch','hangleg'],hangleg:['cablecrunch','plank']}).forEach(([k,v])=>{EX[k].alt=v;});
/* plans: free weights for the main lifts, machines and cables for accessories */
PLANS.fbw2.days[0].ex[5]=x('cablecurl',2,10,15,60);
PLANS.fbw2.days[1].ex[5]=x('ropeoh',3,10,15,60);
PLANS.fbw3.days[1].ex[4]=x('ropeoh',3,10,15,60);
PLANS.fbw3.days[2].ex[0]=x('legpress',3,10,15,150);
PLANS.fbw3.days[2].ex[3]=x('chestpress',3,8,12,120);
PLANS.ul4.days[0].ex[6]=x('ropeoh',2,10,15,60);
PLANS.ul4.days[1].ex[2]=x('legpress',3,10,15,120);
PLANS.ul4.days[1].ex[5]=x('cablecrunch',3,10,15,60);
PLANS.ul4.days[2].ex[2]=x('cablefly',3,12,15,90);
PLANS.ul4.days[2].ex[6]=x('inclinecurl',2,10,15,60);
PLANS.ul4.days[3].ex[4]=x('seatedcalf',4,10,15,60);
PLANS.ppl5.days[0].ex[5]=x('ropeoh',2,10,15,60);
PLANS.ppl5.days[1].ex[3]=x('seatedcalf',4,10,15,60);
PLANS.ppl5.days[1].ex[4]=x('cablecrunch',3,10,15,60);
PLANS.ppl5.days[2].ex[2]=x('cablefly',3,12,15,90);
PLANS.ppl5.days[3].ex[2]=x('machinerow',3,10,12,90);
PLANS.ppl5.days[3].ex[4]=x('hammer',3,10,15,60);
const KINDS=[['bar','Sztanga'],['db','Hantle'],['machine','Maszyna'],['cable','Wyciąg'],['bw','Masa ciała'],['kb','Kettlebell'],['band','Guma']];

/* ---------- Coaching layer: key positions, numbered marks, common faults (side view) ---------- */
const SPINE=(n,l,ph)=>({t:'line',a:'hip',b:'sh',o:15,n,l,ph});
const ANN={
 squat:{sA:['Ustawienie','Gryf na górze czworobocznych, stopy na szerokość barków, palce lekko na zewnątrz. Weź wdech do brzucha i napnij go jak przed ciosem.'],sB:['Dół','Biodra jadą w tył i w dół razem z kolanami. Na dole nie odpoczywasz: od razu wstajesz, wydech na górze.'],
  marks:[{t:'vline',j:'mid',n:1,l:'Gryf przez cały ruch nad środkiem stopy'},{t:'path',j:'bar',l:''},SPINE(2,'Plecy proste, tułów pochyla się tylko tyle, ile trzeba'),{t:'hline',j:'k1',n:3,ph:'B',l:'Zgięcie biodra schodzi na wysokość kolana lub niżej'},{t:'dot',j:'toe',n:4,d:[10,10],l:'Cała stopa na podłodze, pięty nie odrywają się'}],
  bad:[{l:'Zaokrąglone plecy na dole',B:{curve:15},j:'sh',why:'Miednica podwija się, a dolny odcinek pleców traci napięcie. Schodź tylko tak nisko, jak pozwalają proste plecy, i pracuj nad mobilnością bioder.'},
       {l:'Za płytko',B:{hip:[-16,62],t:62},j:'hip',d:[-10,0],why:'Ćwierćprzysiad skraca pracę ud i pośladków o połowę. Zmniejsz ciężar i schodź do równoległej.'}]},
 goblet:{sA:['Ustawienie','Hantla trzymana pionowo pod brodą, łokcie w dół. Stopy nieco szerzej niż barki.'],sB:['Dół','Siadasz między pięty, łokcie mieszczą się między kolanami. Tułów prawie pionowo.'],
  marks:[SPINE(1,'Tułów prawie pionowo przez cały ruch'),{t:'dot',j:'w1',n:2,d:[12,4],l:'Hantla przyklejona do mostka'},{t:'hline',j:'k1',n:3,ph:'B',l:'Biodra poniżej kolan'},{t:'vline',j:'mid',n:4,l:'Ciężar nad środkiem stopy'}],
  bad:[{l:'Hantla odsunięta od ciała',A:{hand:{sh:[26,-10]}},B:{hand:{sh:[28,-8]}},j:'w1',why:'Ciężar daleko przed ciałem ciągnie tułów w przód i przenosi pracę na plecy.'}]},
 bss:{sA:['Ustawienie','Tylna stopa grzbietem na ławce, przednia ok. pół metra przed nią. Tułów pionowo, hantle w dłoniach.'],sB:['Dół','Opuść się pionowo, aż tylne kolano prawie dotknie podłogi. Wstań, pchając przednią piętą.'],
  marks:[{t:'path',j:'hip',n:1,side:-12,l:'Biodro jedzie prosto w dół'},{t:'line',a:'k1',b:'an1',o:-10,n:2,l:'Przednia piszczel blisko pionu'},{t:'dot',j:'k2',n:3,ph:'B',d:[-12,-6],l:'Tylne kolano tuż nad podłogą'}],
  bad:[{l:'Za krótki krok',A:{a:[-14,4]},B:{a:[-14,4]},j:'k1',why:'Kolano wychodzi daleko przed palce, ciężar ląduje na palcach przedniej stopy i boli kolano.'}]},
 lunge:{sA:['Ustawienie','Długi krok, stopy na szerokość bioder. Tułów pionowo, hantle wzdłuż boków.'],sB:['Dół','Tylne kolano schodzi prawie do podłogi, przednie zgięte ok. 90°. Wróć, odpychając się przednią piętą.'],
  marks:[SPINE(1,'Tułów pionowo'),{t:'angle',j:'k1',a:'hip',b:'an1',n:2,ph:'B',l:'Przednie kolano ok. 90°'},{t:'dot',j:'k2',n:3,ph:'B',d:[-12,-6],l:'Tylne kolano tuż nad podłogą'}],
  bad:[{l:'Za krótki krok',A:{a:[6,4]},B:{a:[6,4]},j:'k1',why:'Przednie kolano ucieka daleko przed palce, a pięta odrywa się od podłogi.'},
       {l:'Pochylony tułów',A:{t:72},B:{t:66},j:'sh',why:'Pochylenie zamienia wykrok w ruch biodra i odciąża uda.'}]},
 legext:{sA:['Ustawienie','Plecy przy oparciu, oś maszyny na wysokości kolana, wałek nad kostką.'],sB:['Góra','Pełny wyprost i 1 s pauzy. Opuszczaj powoli, do pełnego zgięcia.'],
  marks:[{t:'dot',j:'k1',n:1,d:[0,14],l:'Kolano w osi obrotu maszyny'},{t:'path',j:'an1',n:2,side:-12,l:'Pełny łuk od zgięcia do wyprostu'},SPINE(3,'Plecy i biodra dociśnięte do siedziska')],
  bad:[{l:'Biodra odrywają się',B:{hip:[4,58]},j:'hip',why:'Wypychanie bioder z siedziska pomaga zarzucić ciężar i zdejmuje pracę z mięśnia czworogłowego.'}]},
 deadlift:{sA:['Start z podłogi','Gryf nad środkiem stopy, piszczele dotykają gryfu. Chwyć gryf, obniż biodra, wyprostuj plecy, łopatki nad gryfem.'],sB:['Góra','Biodra i kolana prostują się razem. Na górze stoisz prosto, bez odchylania w tył.'],
  marks:[{t:'vline',j:'mid',n:1,l:'Gryf nad środkiem stopy'},{t:'path',j:'bar',n:2,side:12,l:'Gryf jedzie po nogach w linii prostej'},SPINE(3,'Plecy neutralne od startu do końca'),{t:'dot',j:'sh',n:4,ph:'A',d:[12,8],l:'Barki nad gryfem lub odrobinę przed nim'}],
  bad:[{l:'Zaokrąglone plecy',A:{curve:17},j:'sh',why:'Okrągłe plecy pod dużym ciężarem przeciążają krążki lędźwiowe. Zmniejsz ciężar i napnij plecy przed oderwaniem gryfu.'},
       {l:'Gryf daleko od nóg',A:{hand:{sh:[18,-56]}},B:{hand:{sh:[10,-56]}},j:'w1',why:'Każdy centymetr od nóg wydłuża dźwignię na plecy. Gryf ma ocierać się o piszczele i uda.'}]},
 rdl:{sA:['Ustawienie','Stań prosto z gryfem przy udach, kolana odblokowane.'],sB:['Dół','Cofaj biodra, gryf zjeżdża po udach. Zatrzymaj się, gdy poczujesz mocne rozciągnięcie z tyłu ud.'],
  marks:[{t:'path',j:'hip',n:1,side:-12,l:'Biodra cofają się w tył, nie w dół'},SPINE(2,'Plecy proste przez cały ruch'),{t:'dot',j:'k1',n:3,d:[12,0],l:'Kolana lekko ugięte, kąt się nie zmienia'},{t:'path',j:'bar',l:''}],
  bad:[{l:'Zaokrąglone plecy',B:{curve:16},j:'sh',why:'Zejście niżej kosztem pleców nie rozciąga mięśni dwugłowych, tylko obciąża kręgosłup.'},
       {l:'Przysiad zamiast zawiasu',B:{hip:[-26,58],t:40},j:'k1',d:[8,0],why:'Gdy kolana mocno się uginają, pracują głównie uda, a dwugłowe prawie się nie rozciągają.'}]},
 hipthrust:{sA:['Dół','Dolne łopatki na krawędzi ławki, gryf w zgięciu bioder na podkładce, stopy płasko.'],sB:['Góra','Wypchnij biodra, aż tułów i uda będą w jednej linii. Broda przy klatce, 1 s pauzy.'],
  marks:[{t:'line',a:'sh',b:'k1',o:0,n:1,ph:'B',l:'Na górze tułów i uda w jednej linii'},{t:'angle',j:'k1',a:'hip',b:'an1',n:2,ph:'B',l:'Kolano ok. 90°, piszczele pionowo'},{t:'dot',j:'sh',n:3,d:[-4,-14],l:'Łopatki na krawędzi ławki'}],
  bad:[{l:'Przeprost w lędźwiach',B:{hip:[14,52],curve:-9},j:'hip',d:[0,12],why:'Wygięcie lędźwi udaje wyższy ruch, ale pośladki pracują słabiej, a kręgosłup dostaje ścisk.'},
       {l:'Stopy za daleko',A:{a:[58,4]},B:{a:[58,4]},j:'an1',why:'Z daleko wysuniętymi stopami pracują głównie dwugłowe zamiast pośladków.'}]},
 legcurl:{sA:['Ustawienie','Plecy przy oparciu, wałek uda dociśnięty, kolano w osi maszyny, nogi proste.'],sB:['Zgięcie','Zegnij nogi maksymalnie, potem wracaj powoli do pełnego wyprostu.'],
  marks:[{t:'dot',j:'k1',n:1,d:[0,-14],l:'Kolano w osi obrotu maszyny'},{t:'path',j:'an1',n:2,side:12,l:'Pełne zgięcie i pełny powrót'},SPINE(3,'Biodra na siedzisku, tułów przy oparciu')],
  bad:[{l:'Skrócony powrót',A:{legA:[2,-40]},j:'an1',why:'Bez pełnego wyprostu tracisz pracę w rozciągnięciu, a to ona daje najwięcej masy.'}]},
 calf:{sA:['Dół','Przód stopy na krawędzi, pięty opuszczone jak najniżej. Pauza 1–2 s.'],sB:['Góra','Wspinaczka maksymalnie wysoko, kolana proste, krótka pauza.'],
  marks:[{t:'path',j:'heel',n:1,side:-10,l:'Pięta od najniższego do najwyższego punktu'},{t:'dot',j:'toe',n:2,d:[12,6],l:'Przód stopy na krawędzi podestu'},{t:'line',a:'hip',b:'an1',o:12,n:3,l:'Kolana proste'}],
  bad:[{l:'Za mały zakres',A:{a:[2,14],ft:2},j:'heel',why:'Bez opuszczenia pięt poniżej podestu łydki nie pracują w rozciągnięciu.'}]},
 bench:{sA:['Góra','Łopatki ściągnięte i wciśnięte w ławkę, stopy w podłodze, gryf nad barkami.'],sB:['Dół','Gryf schodzi w 2–3 s do dołu klatki. Przedramiona pionowo pod gryfem.'],
  marks:[{t:'path',j:'bar',n:1,side:14,l:'Gryf: od barków do dołu mostka po lekkim łuku'},{t:'line',a:'e1',b:'w1',o:0,n:2,ph:'B',l:'Przedramię pionowo pod gryfem'},{t:'dot',j:'toe',n:3,d:[12,8],l:'Stopy mocno w podłodze'}],
  bad:[{l:'Gryf schodzi do szyi',B:{hand:{sh:[-2,12]}},j:'w1',why:'Opuszczanie wysoko na klatkę przeciąża przód barków. Celuj w dół mostka.'},
       {l:'Pośladki nad ławką',A:{hip:[18,64]},B:{hip:[18,64]},j:'hip',d:[0,-12],why:'Odrywanie bioder skraca ruch i obciąża lędźwie. Pośladki cały czas na ławce.'}]},
 dbbench:{sA:['Góra','Hantle nad barkami, łopatki ściągnięte, stopy w podłodze.'],sB:['Dół','Opuszczaj głęboko, aż poczujesz rozciągnięcie klatki. Nadgarstek nad łokciem.'],
  marks:[{t:'path',j:'w1',n:1,side:14,l:'Pełny zakres: głębiej niż przy sztandze'},{t:'line',a:'e1',b:'w1',o:0,n:2,ph:'B',l:'Nadgarstek nad łokciem'},{t:'hline',j:'sh',n:3,ph:'B',l:'Hantle schodzą do linii klatki lub niżej'}],
  bad:[{l:'Za płytko',B:{hand:{sh:[12,24]}},j:'w1',why:'Skrócony ruch pomija pozycję rozciągnięcia, która daje klatce najmocniejszy bodziec.'}]},
 incline:{sA:['Góra','Ławka 30–45°, hantle nad barkami, łopatki ściągnięte.'],sB:['Dół','Hantle schodzą do górnej części klatki, łokcie nieco poniżej linii barków.'],
  marks:[{t:'angle',j:'hip',a:'sh',b:'h',n:1,r:22,l:'Oparcie 30–45°'},{t:'path',j:'w1',n:2,side:14,l:'Wyciskaj w górę nad barki'},{t:'line',a:'e1',b:'w1',o:0,n:3,ph:'B',l:'Przedramię pionowo'}],
  bad:[{l:'Hantle lecą nad twarz',A:{hand:{sh:[-10,56]}},B:{hand:{sh:[-6,10]}},j:'w1',why:'Tor nad twarz przenosi pracę na barki. Prowadź hantle nad barki i górę klatki.'}]},
 pushup:{sA:['Góra','Dłonie pod barkami, ciało w jednej linii, napięty brzuch i pośladki.'],sB:['Dół','Klatka prawie dotyka podłogi, łokcie ok. 45° od tułowia.'],
  marks:[{t:'line',a:'an1',b:'sh',o:-12,n:1,l:'Pięty, biodra i barki w jednej linii'},{t:'dot',j:'w1',n:2,d:[10,10],l:'Dłonie pod barkami'},{t:'path',j:'sh',n:3,side:10,l:'Klatka prawie do podłogi'}],
  bad:[{l:'Opadające biodra',A:{curve:-11},B:{curve:-13},j:'hip',d:[0,-10],why:'Zapadnięte biodra przenoszą obciążenie na lędźwie. Napnij pośladki i brzuch.'},
       {l:'Biodra w górze',A:{t:12},B:{t:-10},j:'hip',d:[0,10],why:'Uniesione biodra skracają ruch klatki i zamieniają pompkę w ćwiczenie na barki.'}]},
 dips:{sA:['Góra','Ręce proste, barki nisko, tułów lekko pochylony, nogi ugięte i skrzyżowane.'],sB:['Dół','Schodź, aż ramię będzie równoległe do podłogi. Łokcie lekko w tył.'],
  marks:[{t:'angle',j:'hip',a:'sh',b:'v',n:1,r:20,l:'Pochylenie w przód mocniej angażuje klatkę'},{t:'line',a:'sh',b:'e1',o:0,n:2,ph:'B',l:'Ramię równolegle do podłogi'},{t:'dot',j:'sh',n:3,d:[12,10],l:'Barki nisko, z dala od uszu'}],
  bad:[{l:'Za głęboko',B:{sh:[16,102]},j:'sh',why:'Bark wychodzi daleko przed staw i przeciąża jego przód. Zatrzymaj się przy ramieniu równoległym.'}]},
 ohp:{sA:['Start','Gryf na górze klatki, łokcie lekko przed gryfem, pośladki i brzuch napięte.'],sB:['Góra','Gryf nad środkiem stopy, głowa „w okno” między rękami, łokcie zablokowane.'],
  marks:[{t:'path',j:'bar',n:1,side:14,l:'Gryf w górę po linii prostej'},{t:'vline',j:'mid',n:2,ph:'B',l:'Na górze gryf nad środkiem stopy'},SPINE(3,'Tułów pionowo, bez odchylania')],
  bad:[{l:'Mocne odchylenie tułowia',A:{t:104},B:{t:106},j:'hip',d:[-12,0],why:'Odchylenie zamienia ruch w wyciskanie na skosie i ściska lędźwie. Napnij pośladki.'}]},
 latraise:{sA:['Start','Hantle przy biodrach, łokcie lekko ugięte, tułów stabilny.'],sB:['Góra','Unieś hantle do wysokości barków, prowadząc ruch łokciem. Opuszczaj w 2–3 s.'],
  marks:[{t:'hline',j:'shN',n:1,ph:'B',l:'Dłonie do wysokości barków, nie wyżej'},{t:'dot',j:'e1',n:2,d:[2,12],l:'Łokieć lekko ugięty, prowadzi ruch'}],
  bad:[{l:'Za wysoko, z zarzutem',B:{armA:[38,50]},j:'w1',why:'Unoszenie wysoko nad barki przenosi pracę na czworoboczny i zwiększa ryzyko bólu barku.'}]},
 facepull:{sA:['Start','Wyciąg na wysokości twarzy, lina nachwytem, ręce wyprostowane.'],sB:['Koniec','Lina przy czole, łokcie wysoko i szeroko, dłonie za uszami.'],
  marks:[{t:'path',j:'w1',n:1,side:10,l:'Ciągnij do czoła'},{t:'hline',j:'shN',n:2,ph:'B',l:'Łokcie na wysokości barków'},SPINE(3,'Tułów stabilny')],
  bad:[{l:'Ciągnięcie do brzucha',B:{hand:{sh:[16,-22]}},j:'w1',why:'Niski tor zamienia ruch w wiosłowanie i omija tylne aktony barków.'}]},
 row:{sA:['Start','Tułów pochylony, plecy proste, gryf zwisa pod barkami na prostych rękach.'],sB:['Góra','Przyciągnij gryf do dołu brzucha, ściągnij łopatki, opuszczaj z kontrolą.'],
  marks:[{t:'angle',j:'hip',a:'sh',b:'h',n:1,r:22,l:'Tułów ok. 30–45° nad poziomem'},{t:'path',j:'bar',n:2,side:12,l:'Gryf do dołu brzucha'},SPINE(3,'Plecy proste')],
  bad:[{l:'Prostowanie tułowia',B:{t:62},j:'sh',why:'Bujanie tułowiem przenosi pracę z pleców na biodra.'},{l:'Zaokrąglone plecy',A:{curve:14},B:{curve:14},j:'sh',why:'Okrągłe plecy w pochyleniu obciążają odcinek lędźwiowy.'}]},
 dbrow:{sA:['Start','Wolna ręka na ławce pod barkiem, plecy równolegle do podłogi, hantla na prostej ręce.'],sB:['Góra','Łokieć jedzie do biodra, hantla przy boku. Opuszczaj do pełnego rozciągnięcia.'],
  marks:[SPINE(1,'Plecy równolegle do podłogi'),{t:'path',j:'w1',n:2,side:-12,l:'Łokieć do biodra, nie do barku'},{t:'dot',j:'w2',n:3,d:[10,10],l:'Ręka podporowa pod barkiem'}],
  bad:[{l:'Rotacja tułowia',B:{t:32},j:'sh',why:'Skręcanie tułowia skraca pracę najszerszego grzbietu.'}]},
 cablerow:{sA:['Start','Stopy na podeście, kolana lekko ugięte, lekkie pochylenie w przód z wyprostowanymi rękami.'],sB:['Koniec','Tułów w pionie, uchwyt przy brzuchu, łokcie wzdłuż tułowia, łopatki ściągnięte.'],
  marks:[{t:'path',j:'w1',n:1,side:10,l:'Uchwyt do brzucha'},{t:'angle',j:'hip',a:'sh',b:'v',n:2,r:22,ph:'B',l:'Tułów wraca do pionu, nie dalej'},{t:'dot',j:'e1',n:3,ph:'B',d:[-12,0],l:'Łokcie wzdłuż tułowia'}],
  bad:[{l:'Odchylanie w tył',B:{t:122},j:'sh',why:'Mocne odchylenie robi z ćwiczenia bujanie i zabiera pracę plecom.'}]},
 pullup:{sA:['Zwis','Pełny zwis na prostych rękach, barki aktywne, nogi razem.'],sB:['Góra','Broda nad drążkiem, klatka do drążka, łokcie w dół do żeber.'],
  marks:[{t:'path',j:'sh',n:1,side:12,l:'Klatka jedzie do drążka'},{t:'line',a:'sh',b:'w1',o:0,n:2,ph:'A',l:'Pełny zwis na dole'},{t:'hline',j:'w1',n:3,ph:'B',l:'Broda nad drążkiem'}],
  bad:[{l:'Półpowtórzenia',A:{sh:[-4,-36]},j:'e1',why:'Bez pełnego zwisu tracisz rozciągnięcie mięśnia najszerszego.'}]},
 latpull:{sA:['Start','Uda pod wałkiem, ręce wyprostowane, klatka do góry.'],sB:['Koniec','Drążek przy górnej części klatki, łokcie w dół i lekko w tył.'],
  marks:[{t:'path',j:'w1',n:1,side:12,l:'Drążek do górnej części klatki'},{t:'angle',j:'hip',a:'sh',b:'v',n:2,r:24,l:'Lekkie odchylenie, ok. 10–20°'},{t:'dot',j:'e1',n:3,ph:'B',d:[-12,-4],l:'Łokcie w dół i lekko w tył'}],
  bad:[{l:'Mocne bujanie',A:{t:100},B:{t:130},j:'sh',why:'Odchylanie się do leżenia zamienia ruch w wiosłowanie i ułatwia oszukiwanie ciężarem.'}]},
 curl:{sA:['Start','Ręce wyprostowane, łokcie przy bokach, tułów nieruchomy.'],sB:['Góra','Uginaj, supinując nadgarstek. Łokieć zostaje w miejscu.'],
  marks:[{t:'dot',j:'e1',n:1,d:[-12,0],l:'Łokieć przy tułowiu, nieruchomo'},{t:'path',j:'w1',n:2,side:12,l:'Pełny łuk od wyprostu'},SPINE(3,'Tułów nie buja się')],
  bad:[{l:'Bujanie tułowiem',A:{t:84},B:{t:104},j:'hip',d:[-12,0],why:'Zarzucanie ciężaru biodrami zabiera pracę bicepsowi.'}]},
 triext:{sA:['Góra','Hantla nad głową, ramiona przy uszach, łokcie w górę.'],sB:['Dół','Opuść hantlę głęboko za głowę. Ramiona zostają nieruchomo.'],
  marks:[{t:'dot',j:'e1',n:1,d:[12,4],l:'Łokcie w górę, blisko głowy'},{t:'path',j:'w1',n:2,side:-12,l:'Głęboko za głowę'},SPINE(3,'Bez wyginania lędźwi')],
  bad:[{l:'Łokcie uciekają do przodu',A:{armA:[70,90]},B:{armA:[45,-120]},j:'e1',why:'Opuszczanie ramion skraca rozciągnięcie długiej głowy tricepsa.'}]},
 pushdown:{sA:['Start','Łokcie przy bokach, przedramiona nad poziomem, lekkie pochylenie.'],sB:['Dół','Pełny wyprost w łokciach. Wracaj do góry bez ruchu ramion.'],
  marks:[{t:'dot',j:'e1',n:1,d:[-12,0],l:'Łokcie przyklejone do boków'},{t:'path',j:'w1',n:2,side:12,l:'Pełny wyprost w dół'},SPINE(3,'Tułów nieruchomo')],
  bad:[{l:'Łokcie wędrują',A:{armA:[-40,50]},j:'e1',why:'Ruch w barkach przenosi pracę na klatkę i najszerszy.'}]},
 plank:{sA:['Pozycja','Łokcie pod barkami, ciało w jednej linii, pośladki i brzuch napięte.'],sB:['Pozycja','Oddychaj spokojnie, nie podnoś bioder.'],
  marks:[{t:'line',a:'an1',b:'sh',o:12,n:1,l:'Głowa, biodra i pięty w jednej linii'},{t:'dot',j:'e1',n:2,d:[10,12],l:'Łokcie pod barkami'}],
  bad:[{l:'Opadające biodra',A:{curve:-12},B:{curve:-12},j:'hip',d:[0,-10],why:'Zapadnięte biodra obciążają lędźwie zamiast brzucha.'},{l:'Biodra za wysoko',A:{t:-14},B:{t:-14},j:'hip',d:[0,10],why:'Uniesione biodra skracają dźwignię i brzuch prawie nie pracuje.'}]},
 hangleg:{sA:['Zwis','Pełny zwis, barki aktywne, nogi razem.'],sB:['Góra','Podwiń miednicę i unieś kolana co najmniej do wysokości bioder.'],
  marks:[{t:'path',j:'k1',n:1,side:12,l:'Kolana co najmniej do bioder'},{t:'dot',j:'hip',n:2,ph:'B',d:[-12,-6],l:'Podwinięta miednica'},{t:'dot',j:'w1',n:3,d:[10,-4],l:'Mocny chwyt, barki aktywne'}],
  bad:[{l:'Wymach całym ciałem',A:{t:76},B:{t:118},j:'sh',why:'Bujanie wykonuje ruch za brzuch. Zatrzymaj wahadło przed kolejnym powtórzeniem.'}]},
 farmer:{sA:['Marsz','Ciężkie hantle w dłoniach, barki ściągnięte, tułów pionowo.'],sB:['Marsz','Krótkie, szybkie kroki, oddychaj, nie pochylaj się na boki.'],
  marks:[SPINE(1,'Tułów pionowo, barki ściągnięte'),{t:'dot',j:'w1',n:2,d:[12,0],l:'Mocny chwyt przez cały czas'}],
  bad:[{l:'Pochylony tułów',A:{t:76},B:{t:76},j:'sh',why:'Pochylenie z ciężarem w dłoniach obciąża odcinek lędźwiowy.'}]}
};
for(const id in ANN)Object.assign(EX[id].fig,ANN[id]);

const ANN2={
 legpress:{sA:['Góra','Plecy i pośladki przy oparciu, stopy na środku platformy, kolana lekko ugięte.'],sB:['Dół','Opuszczaj platformę, aż kolana zbliżą się do klatki. Pośladki nie odrywają się od oparcia.'],
  marks:[{t:'angle',j:'k1',a:'hip',b:'an1',n:1,ph:'B',l:'Kolano ok. 90° lub mniej, jeśli plecy zostają przy oparciu'},SPINE(2,'Lędźwie i pośladki dociśnięte do oparcia'),{t:'dot',j:'an1',n:3,d:[12,-6],l:'Całe stopy na platformie, ciężar na piętach'}],
  bad:[{l:'Pośladki odrywają się na dole',B:{a:[20,48],curve:12},j:'hip',d:[-6,-6],why:'Za głębokie zejście podwija miednicę i zaokrągla lędźwie pod dużym ciężarem. Zatrzymaj się przed tym momentem.'}]},
 hack:{sA:['Góra','Plecy na oparciu, barki pod poduszkami, stopy na środku platformy.'],sB:['Dół','Schodź głęboko, aż uda będą równoległe do platformy lub niżej. Pięty dociśnięte.'],
  marks:[SPINE(1,'Całe plecy na oparciu'),{t:'hline',j:'k1',n:2,ph:'B',l:'Biodra na wysokości kolan lub niżej'},{t:'dot',j:'heel',n:3,d:[-10,-8],l:'Pięty dociśnięte do platformy'}],
  bad:[{l:'Za płytko',B:{hip:[3,62]},j:'hip',d:[-12,0],why:'Płytkie powtórzenia z dużym ciężarem dają mało pracy udom. Zmniejsz ciężar i zejdź niżej.'}]},
 chestpress:{sA:['Start','Uchwyty przy klatce, łopatki ściągnięte i przy oparciu.'],sB:['Wyprost','Wypchnij uchwyty przed siebie, łokcie prawie proste.'],
  marks:[{t:'path',j:'w1',n:1,side:10,l:'Uchwyty na wysokości środka klatki'},SPINE(2,'Plecy i łopatki przy oparciu'),{t:'dot',j:'e1',n:3,ph:'A',d:[-12,-4],l:'Łokcie lekko poniżej barków'}],
  bad:[{l:'Plecy odrywają się od oparcia',B:{t:78,hand:{sh:[50,-4]}},j:'sh',why:'Pochylanie się w przód zamienia wyciskanie w pchanie tułowiem i zabiera pracę klatce.'}]},
 pecdeck:{sA:['Rozciągnięcie','Ręce szeroko na wysokości klatki, łokcie lekko ugięte.'],sB:['Spięcie','Zbliż dłonie przed klatką, ściśnij klatkę na 1 s.'],
  marks:[{t:'hline',j:'shN',n:1,l:'Ręce na wysokości barków i klatki'},{t:'dot',j:'e1',n:2,d:[4,12],l:'Łokcie lekko ugięte przez cały ruch'}],
  bad:[{l:'Skrócony powrót',A:{armA:[-12,8]},j:'w1',why:'Bez szerokiego powrotu klatka nie pracuje w rozciągnięciu.'}]},
 revpec:{sA:['Start','Ręce przed sobą na wysokości barków, chwyt neutralny.'],sB:['Koniec','Ręce rozłożone w linii barków, łokcie lekko ugięte.'],
  marks:[{t:'hline',j:'shN',n:1,l:'Ręce na wysokości barków'},{t:'dot',j:'e1',n:2,d:[4,12],l:'Łokcie lekko ugięte, nieruchome'}],
  bad:[{l:'Za daleko do tyłu',B:{armA:[22,30]},j:'w1',why:'Odciąganie rąk wysoko i daleko w tył przenosi pracę na czworoboczny.'}]},
 machpress:{sA:['Start','Uchwyty na wysokości barków, plecy przy oparciu.'],sB:['Góra','Wypchnij pionowo w górę, łokcie prawie proste.'],
  marks:[{t:'path',j:'w1',n:1,side:12,l:'Pchaj pionowo w górę'},SPINE(2,'Plecy przy oparciu, brzuch napięty'),{t:'hline',j:'sh',n:3,ph:'A',l:'Uchwyty startują na wysokości barków'}],
  bad:[{l:'Odchylanie od oparcia',A:{t:110},B:{t:112},j:'hip',d:[-12,0],why:'Wyginanie lędźwi zamienia ruch w wyciskanie klatką i obciąża kręgosłup.'}]},
 machinerow:{sA:['Start','Klatka na poduszce, ręce wyprostowane, łopatki wysunięte.'],sB:['Koniec','Łokcie w tył wzdłuż tułowia, łopatki ściśnięte.'],
  marks:[{t:'path',j:'w1',n:1,side:-10,l:'Uchwyty do dołu klatki'},{t:'dot',j:'e1',n:2,ph:'B',d:[-12,0],l:'Łokcie za linię tułowia'},SPINE(3,'Klatka cały czas na poduszce')],
  bad:[{l:'Odchylanie się od poduszki',B:{t:112},j:'sh',why:'Bujanie tułowiem zabiera pracę mięśniom pleców.'}]},
 lyingcurl:{sA:['Start','Leżysz przodem, biodra dociśnięte, kolana tuż za ławką, nogi proste.'],sB:['Zgięcie','Zegnij nogi maksymalnie i wróć powoli do wyprostu.'],
  marks:[{t:'path',j:'an1',n:1,side:10,l:'Pełne zgięcie i pełny powrót'},{t:'dot',j:'hip',n:2,d:[0,14],l:'Biodra dociśnięte do ławki'},{t:'dot',j:'k1',n:3,d:[-4,-14],l:'Kolano tuż za krawędzią ławki'}],
  bad:[{l:'Unoszenie bioder',B:{hip:[0,52],t:-12},j:'hip',d:[0,12],why:'Podnoszenie bioder pozwala zarzucić ciężar i skraca pracę dwugłowych.'}]},
 seatedcalf:{sA:['Dół','Wałek nad kolanami, pięty opuszczone najniżej. Pauza 1–2 s.'],sB:['Góra','Wspinaczka jak najwyżej, krótka pauza.'],
  marks:[{t:'path',j:'heel',n:1,side:-8,l:'Pięta od najniższego do najwyższego punktu'},{t:'dot',j:'toe',n:2,d:[10,8],l:'Przód stopy na krawędzi'}],
  bad:[{l:'Za mały zakres',A:{legA:[4,-92],ft:12},j:'heel',why:'Bez opuszczenia pięt łydki nie pracują w rozciągnięciu.'}]},
 cablefly:{sA:['Rozciągnięcie','Ręce szeroko i wysoko, łokcie lekko ugięte, krok w przód.'],sB:['Spięcie','Dłonie spotykają się przed biodrami, ściśnij klatkę.'],
  marks:[{t:'path',j:'w1',n:1,side:10,l:'Łuk w dół i do środka'},{t:'dot',j:'e1',n:2,d:[6,12],l:'Łokcie lekko ugięte, kąt się nie zmienia'}],
  bad:[{l:'Wyciskanie zamiast rozpiętek',B:{armA:[-150,-40]},j:'e1',why:'Uginanie łokci zamienia ćwiczenie w wyciskanie i zmniejsza rozciągnięcie klatki.'}]},
 cablecurl:{sA:['Start','Przodem do dolnego wyciągu, ręce proste, łokcie przy bokach.'],sB:['Góra','Uginaj do pełnego spięcia, łokieć zostaje w miejscu.'],
  marks:[{t:'dot',j:'e1',n:1,d:[-12,0],l:'Łokieć przy tułowiu, nieruchomo'},{t:'path',j:'w1',n:2,side:12,l:'Pełny łuk od wyprostu'},SPINE(3,'Tułów nie buja się')],
  bad:[{l:'Łokcie wędrują do przodu',B:{armA:[-40,96]},j:'e1',why:'Wysuwanie łokci zamienia ruch w unoszenie ramion i odciąża biceps na górze.'}]},
 ropeoh:{sA:['Rozciągnięcie','Lina za głową, łokcie przy głowie, lekkie pochylenie.'],sB:['Wyprost','Wyprostuj ręce w przód i w górę.'],
  marks:[{t:'dot',j:'e1',n:1,d:[12,4],l:'Łokcie przy głowie, nieruchome'},{t:'path',j:'w1',n:2,side:12,l:'Pełny wyprost w przód'},SPINE(3,'Pochylenie, napięty brzuch')],
  bad:[{l:'Łokcie opadają',A:{armA:[40,-100]},B:{armA:[36,44]},j:'e1',why:'Opadające łokcie skracają rozciągnięcie długiej głowy tricepsa.'}]},
 cablelat:{sA:['Start','Bokiem do dolnego wyciągu, uchwyt przed biodrem.'],sB:['Góra','Unieś rękę do wysokości barku, prowadząc łokciem.'],
  marks:[{t:'hline',j:'shN',n:1,ph:'B',l:'Dłoń do wysokości barku'},{t:'dot',j:'e1',n:2,d:[4,12],l:'Łokieć lekko ugięty, prowadzi ruch'}],
  bad:[{l:'Za wysoko',B:{armA:[40,48]},j:'w1',why:'Unoszenie wysoko nad bark przenosi pracę na czworoboczny.'}]},
 cablecrunch:{sA:['Start','Klęk, lina przy głowie, biodra nad kolanami.'],sB:['Spięcie','Zwiń tułów, żebra do miednicy, łokcie w stronę ud.'],
  marks:[{t:'dot',j:'hip',n:1,d:[-12,6],l:'Biodra nieruchomo, nie siadaj na piętach'},{t:'path',j:'head',n:2,side:12,l:'Zwijaj tułów w łuk'},{t:'dot',j:'w1',n:3,d:[12,6],l:'Lina przy głowie przez cały ruch'}],
  bad:[{l:'Ruch z bioder',B:{hip:[-16,36],curve:0,t:20},j:'hip',d:[-8,-10],why:'Siadanie na piętach to praca bioder, a brzuch prawie się nie skraca.'}]},
 straightpd:{sA:['Start','Lekki skłon, ręce prawie proste przed sobą, wyżej niż głowa.'],sB:['Koniec','Ściągnij drążek po łuku do ud.'],
  marks:[{t:'path',j:'w1',n:1,side:12,l:'Łuk od wysokości głowy do ud'},{t:'dot',j:'e1',n:2,d:[12,4],l:'Łokcie lekko ugięte, nieruchome'},SPINE(3,'Plecy proste')],
  bad:[{l:'Uginanie łokci',B:{armA:[-40,-120]},j:'e1',why:'Zginanie łokci zamienia ćwiczenie w prostowanie ramion na triceps.'}]},
 dbohp:{sA:['Start','Hantle na wysokości barków, plecy przy oparciu.'],sB:['Góra','Wyciśnij hantle nad głowę, zbliżając je do siebie.'],
  marks:[{t:'path',j:'w1',n:1,side:12,l:'Pchaj pionowo nad barki'},SPINE(2,'Plecy przy oparciu, bez wyginania lędźwi'),{t:'hline',j:'sh',n:3,ph:'A',l:'Hantle schodzą do wysokości barków'}],
  bad:[{l:'Odchylanie się',A:{t:108},B:{t:110},j:'hip',d:[-12,0],why:'Wyginanie się w tył obciąża lędźwie i zamienia ruch w wyciskanie klatką.'}]},
 hammer:{sA:['Start','Hantle wzdłuż boków, kciuki do przodu.'],sB:['Góra','Uginaj z chwytem neutralnym, łokcie przy bokach.'],
  marks:[{t:'dot',j:'e1',n:1,d:[-12,0],l:'Łokieć przy tułowiu, nieruchomo'},{t:'path',j:'w1',n:2,side:12,l:'Pełny łuk od wyprostu'},SPINE(3,'Tułów nie buja się')],
  bad:[{l:'Bujanie tułowiem',A:{t:84},B:{t:104},j:'hip',d:[-12,0],why:'Zarzucanie ciężaru biodrami zabiera pracę ramionom.'}]},
 inclinecurl:{sA:['Start','Ręce zwisają za linią tułowia, ramię pionowo.'],sB:['Góra','Uginaj, nie przesuwając ramienia do przodu.'],
  marks:[{t:'dot',j:'e1',n:1,d:[-12,-4],l:'Ramię pionowo, za linią tułowia'},{t:'path',j:'w1',n:2,side:12,l:'Pełny łuk od wyprostu'},SPINE(3,'Plecy na oparciu')],
  bad:[{l:'Łokcie wędrują do przodu',B:{armA:[-50,92]},j:'e1',why:'Wysuwanie łokci kasuje przewagę tej wersji: rozciągnięcie bicepsa.'}]},
 dbrdl:{sA:['Ustawienie','Stań prosto, hantle przy udach, kolana odblokowane.'],sB:['Dół','Cofaj biodra, hantle zjeżdżają blisko nóg, do mocnego rozciągnięcia z tyłu ud.'],
  marks:[{t:'path',j:'hip',n:1,side:-12,l:'Biodra w tył, nie w dół'},SPINE(2,'Plecy proste'),{t:'dot',j:'k1',n:3,d:[12,0],l:'Kolana lekko ugięte, nieruchome'}],
  bad:[{l:'Zaokrąglone plecy',B:{curve:16},j:'sh',why:'Zejście niżej kosztem pleców obciąża kręgosłup zamiast rozciągać dwugłowe.'}]},
 stepup:{sA:['Start','Cała stopa na skrzyni, tułów lekko pochylony, hantle w dłoniach.'],sB:['Góra','Wyprostuj nogę na skrzyni, tylna noga tylko dochodzi.'],
  marks:[{t:'path',j:'hip',n:1,side:-12,l:'Wstań przez przednią piętę'},{t:'dot',j:'an1',n:2,d:[12,8],l:'Cała stopa na skrzyni'},SPINE(3,'Tułów prosto')],
  bad:[{l:'Odbijanie tylną nogą',A:{a2:[-18,12],ft2:-60},j:'an2',d:[0,8],why:'Wybicie z tylnej nogi robi połowę pracy za przednie udo.'}]},
 skull:{sA:['Góra','Leżysz na ławce, hantle nad czołem, ramiona lekko w stronę głowy.'],sB:['Dół','Opuść hantle za głowę, łokcie zostają w miejscu.'],
  marks:[{t:'dot',j:'e1',n:1,d:[12,4],l:'Łokcie nieruchomo, w stronę sufitu'},{t:'path',j:'w1',n:2,side:-10,l:'Hantle schodzą za głowę'},{t:'line',a:'sh',b:'e1',o:0,n:3,l:'Ramię lekko odchylone w stronę głowy'}],
  bad:[{l:'Łokcie wędrują',B:{armA:[140,214]},j:'e1',why:'Ruch ramion zamienia ćwiczenie w pullover i zabiera pracę tricepsom.'}]}
};
for(const id in ANN2)Object.assign(EX[id].fig,ANN2[id]);

/* ---------- More exercises (1.5) ----------
   Variants reuse a base exercise's figure, phases and fault modes; fig overrides replace whole keys. */
const deep=o=>JSON.parse(JSON.stringify(o));
const SMITH=x=>({t:'rail',from:[x,0],to:[x,178],w:3});
function variant(id,base,o){
  const fig=Object.assign(base?deep(EX[base].fig):{},o.fig||{});
  EX[id]={...o,fig};
}
/* chest */
variant('inclinebar','incline',{n:'Wyciskanie sztangi na skosie',en:'Incline barbell press',p:'hpush',kind:'bar',inc:2.5,m:{chest:1,delts:0.5,triceps:0.5},
 cues:['Ławka 30–45°, łopatki ściągnięte i wciśnięte w oparcie','Gryf schodzi do górnej części klatki','Przedramiona pionowo pod gryfem','Wyciskaj w górę nad barki'],
 err:['Za wysoki kąt ławki: pracują głównie barki','Odbijanie gryfu od klatki'],alt:['incline','smithincl'],
 fig:{eq:[{t:'bench',pts:[[40,42],[6,42],[-34,74]]},{t:'bar',at:'hand'}]}});
variant('smithbench','bench',{n:'Wyciskanie na suwnicy Smitha',en:'Smith machine bench press',p:'hpush',kind:'machine',inc:2.5,m:{chest:1,triceps:0.5,delts:0.5},
 cues:['Ławka ustawiona tak, by gryf schodził na dół mostka','Łopatki ściągnięte, stopy w podłodze','Opuszczaj 2–3 s, bez odbijania'],
 err:['Ławka źle ustawiona: gryf trafia w szyję albo brzuch','Łokcie rozstawione na 90°'],alt:['bench','chestpress'],
 fig:{eq:[{t:'bench',pts:[[-78,46],[30,46]]},SMITH(-30),{t:'bar',at:'hand'}]}});
variant('smithincl','incline',{n:'Wyciskanie na skosie na suwnicy Smitha',en:'Smith machine incline press',p:'hpush',kind:'machine',inc:2.5,m:{chest:1,delts:0.5,triceps:0.5},
 cues:['Ławka 30–45° tak, by gryf schodził na górę klatki','Łopatki przy oparciu','Pełny zakres, powolne opuszczanie'],
 err:['Gryf ląduje na szyi','Pośladki odrywają się od ławki'],alt:['inclinebar','incline'],
 fig:{eq:[{t:'bench',pts:[[40,42],[6,42],[-34,74]]},SMITH(-22),{t:'bar',at:'hand'}]}});
variant('inclinemach','chestpress',{n:'Wyciskanie na skosie na maszynie',en:'Incline machine press',p:'hpush',kind:'machine',inc:5,m:{chest:1,delts:0.5,triceps:0.5},
 cues:['Siedzisko tak, by uchwyty były na wysokości górnej części klatki','Plecy i łopatki przy oparciu','Wyciskaj w górę i do przodu'],
 err:['Uchwyty za wysoko: pracują głównie barki','Skrócony zakres przy klatce'],alt:['incline','chestpress'],
 fig:{sA:['Start','Uchwyty przy górnej części klatki, łopatki przy oparciu.'],sB:['Wyprost','Wyciśnij w górę i do przodu, łokcie prawie proste.']}});
/* back */
variant('chinup','pullup',{n:'Podciąganie podchwytem',en:'Chin-up',p:'vpull',kind:'bw',inc:2.5,m:{back:1,biceps:0.5},
 cues:['Chwyt podchwytem na szerokość barków','Zacznij z pełnego zwisu','Klatka do drążka, łokcie w dół'],
 err:['Półpowtórzenia bez pełnego zwisu','Bujanie nogami'],alt:['pullup','closepull']});
variant('closepull','latpull',{n:'Ściąganie wąskim uchwytem',en:'Close-grip pulldown',p:'vpull',kind:'cable',inc:5,m:{back:1,biceps:0.5},
 cues:['Uchwyt V lub wąski, ręce w pełni wyprostowane u góry','Ściągaj do górnej części klatki','Łokcie prowadź w dół wzdłuż tułowia'],
 err:['Mocne odchylanie tułowia','Skrócony powrót u góry'],alt:['latpull','chinup']});
variant('onearmpull','latpull',{n:'Ściąganie jednorącz na wyciągu',en:'Single-arm lat pulldown',p:'vpull',kind:'cable',inc:2.5,uni:1,m:{back:1,biceps:0.5},
 cues:['Uchwyt jednorącz, ręka w pełni wyprostowana u góry','Łokieć w dół do biodra','Tułów nie skręca się'],
 err:['Skręcanie tułowia','Ciągnięcie samym bicepsem'],alt:['latpull','closepull']});
variant('tbar','row',{n:'Wiosłowanie T-bar',en:'T-bar row',p:'hpull',kind:'bar',inc:2.5,m:{back:1,biceps:0.5},
 cues:['Tułów pochylony, plecy proste','Uchwyt do dołu klatki','Łopatki ściągaj na końcu ruchu'],
 err:['Prostowanie tułowia przy każdym powtórzeniu','Zaokrąglone plecy'],alt:['row','cablerow']});
variant('onearmrow','cablerow',{n:'Wiosłowanie jednorącz na wyciągu',en:'Single-arm cable row',p:'hpull',kind:'cable',inc:2.5,uni:1,m:{back:1,biceps:0.5},
 cues:['Siedząc, uchwyt jednorącz, ręka wyprostowana','Łokieć wzdłuż tułowia do biodra','Na początku pozwól łopatce wysunąć się do przodu'],
 err:['Skręcanie tułowia zamiast ruchu ręką','Odchylanie się w tył'],alt:['cablerow','dbrow']});
/* shoulders */
variant('arnold','dbohp',{n:'Wyciskanie Arnolda',en:'Arnold press',p:'vpush',kind:'db',inc:2,m:{delts:1,triceps:0.5},
 cues:['Start: hantle przed twarzą, dłonie do siebie','W trakcie wyciskania obracaj dłonie na zewnątrz','Na górze ręce nad barkami'],
 err:['Wyginanie lędźwi','Za ciężkie hantle, skrócony zakres'],alt:['dbohp','ohp']});
variant('seatedlat',null,{n:'Unoszenie bokiem siedząc',en:'Seated lateral raise',p:'iso',kind:'db',inc:1,m:{delts:1},
 cues:['Siedząc prosto, hantle przy biodrach','Unoś bokiem do wysokości barków','Łokieć lekko ugięty, prowadzi ruch'],
 err:['Unoszenie wyżej niż barki z zarzutem','Bujanie tułowiem'],alt:['latraise','cablelat'],
 fig:{front:1,ecc:'BA',hl:['ua'],eq:FRONT_SEAT.concat([{t:'db',at:'hand',r:6},{t:'db',at:'hand2',r:6}]),
  A:{a:[9,4],hip:[0,48],t:90,seatF:1,armA:[-82,-86],h:90},B:{a:[9,4],hip:[0,48],t:90,seatF:1,armA:[2,-4],h:90},
  sA:['Start','Siedzisz prosto, hantle przy biodrach, łokcie lekko ugięte.'],sB:['Góra','Ręce do wysokości barków, łokieć lekko wyżej niż dłoń.'],
  marks:[{t:'hline',j:'sh',n:1,ph:'B',l:'Dłonie do wysokości barków, nie wyżej'}],bad:[]}});
variant('smithohp','dbohp',{n:'Wyciskanie nad głowę na suwnicy Smitha',en:'Smith machine shoulder press',p:'vpush',kind:'machine',inc:2.5,m:{delts:1,triceps:0.5},
 cues:['Siedząc, ławka prawie pionowo, gryf przed twarzą','Opuszczaj do wysokości brody','Wyciskaj pionowo, plecy przy oparciu'],
 err:['Odchylanie się i wyginanie lędźwi','Skrócony zakres'],alt:['dbohp','machpress'],
 fig:{eq:SEAT.concat([SMITH(16),{t:'bar',at:'hand'}])}});
/* biceps */
variant('preacher',null,{n:'Uginanie na modlitewniku',en:'Preacher curl',p:'iso',kind:'db',inc:1,m:{biceps:1},
 cues:['Ramię oparte całe na pulpicie, pacha przy krawędzi','Opuszczaj prawie do pełnego wyprostu','Unoś bez odrywania ramienia'],
 err:['Odrywanie łokcia od pulpitu','Skrócony zakres na dole'],alt:['curl','inclinecurl'],
 fig:{ecc:'BA',hl:['fa'],eq:SEAT.concat([{t:'rail',from:[30,58],to:[30,0],w:4},{t:'bench',pts:[[3,86],[30,58]],noLegs:true},{t:'db',at:'hand'}]),
  A:{a:[44,4],hip:[0,46],t:84,armA:[-48,-62],h:75},B:{a:[44,4],hip:[0,46],t:84,armA:[-48,72],h:75},
  sA:['Dół','Ramię na pulpicie, ręka prawie wyprostowana.'],sB:['Góra','Zegnij rękę do pionu przedramienia, ramię zostaje na pulpicie.'],
  marks:[],bad:[]}});
variant('barcurl','curl',{n:'Uginanie ramion ze sztangą',en:'Barbell curl',p:'iso',kind:'bar',inc:2.5,m:{biceps:1},
 cues:['Chwyt podchwytem na szerokość barków','Łokcie przy tułowiu, nieruchomo','Opuszczaj do pełnego wyprostu'],
 err:['Bujanie tułowiem','Łokcie wędrują do przodu'],alt:['curl','ezcurl'],fig:{eq:[{t:'bar',at:'hand'}]}});
variant('ezcurl','curl',{n:'Uginanie ze sztangą łamaną',en:'EZ-bar curl',p:'iso',kind:'bar',inc:2.5,m:{biceps:1},
 cues:['Chwyt za wewnętrzne łamanie gryfu','Łokcie przy tułowiu','Pełny zakres, powolne opuszczanie'],
 err:['Bujanie tułowiem','Skrócony zakres na dole'],alt:['barcurl','curl'],fig:{eq:[{t:'bar',at:'hand'}]}});
variant('conc',null,{n:'Uginanie w skupieniu',en:'Concentration curl',p:'iso',kind:'db',inc:1,uni:1,m:{biceps:1},
 cues:['Siedząc, łokieć oparty o wewnętrzną stronę uda','Opuszczaj do pełnego wyprostu','Unoś bez ruszania ramieniem'],
 err:['Pomaganie sobie tułowiem','Łokieć zsuwa się z uda'],alt:['curl','preacher'],
 fig:{ecc:'BA',hl:['fa'],eq:SEAT.concat([{t:'db',at:'hand'}]),
  A:{a:[40,4],hip:[0,46],t:58,armA:[-84,-86],h:40},B:{a:[40,4],hip:[0,46],t:58,armA:[-84,82],h:40},
  sA:['Dół','Łokieć przy wewnętrznej stronie uda, ręka wyprostowana.'],sB:['Góra','Zegnij rękę, ramię zostaje nieruchomo.'],
  marks:[],bad:[]}});
variant('cablecurl1','cablecurl',{n:'Uginanie jednorącz na wyciągu',en:'Single-arm cable curl',p:'iso',kind:'cable',inc:2.5,uni:1,m:{biceps:1},
 cues:['Przodem do dolnego wyciągu, uchwyt jednorącz','Łokieć przy tułowiu','Pełny wyprost na dole'],
 err:['Łokieć wędruje do przodu','Bujanie tułowiem'],alt:['cablecurl','curl']});
/* triceps */
variant('cgbench','bench',{n:'Wyciskanie wąsko',en:'Close-grip bench press',p:'hpush',kind:'bar',inc:2.5,m:{triceps:1,chest:0.5,delts:0.5},
 cues:['Chwyt na szerokość barków','Łokcie blisko tułowia','Gryf schodzi do dołu mostka'],
 err:['Za wąski chwyt obciąża nadgarstki','Łokcie rozstawione na boki'],alt:['skull','pushdown']});
variant('pushdown1','pushdown',{n:'Prostowanie jednorącz na wyciągu',en:'Single-arm pushdown',p:'iso',kind:'cable',inc:2.5,uni:1,m:{triceps:1},
 cues:['Łokieć przy boku, nieruchomo','Pełny wyprost w dół','Powolny powrót'],
 err:['Łokieć wędruje do przodu','Pochylanie się nad uchwytem'],alt:['pushdown','ropeoh']});
variant('ezskull','skull',{n:'Wyciskanie francuskie sztangą łamaną',en:'EZ-bar skull crusher',p:'iso',kind:'bar',inc:2.5,m:{triceps:1},
 cues:['Leżąc, gryf nad czołem na prostych rękach','Opuszczaj za głowę, łokcie nieruchomo','Ramiona lekko odchylone w stronę głowy'],
 err:['Łokcie rozjeżdżają się na boki','Ruch w barkach zamiast w łokciach'],alt:['skull','ropeoh'],fig:{eq:[{t:'bench',pts:[[-78,46],[30,46]]},{t:'bar',at:'hand'}]}});
variant('triext1','triext',{n:'Wyprost jednorącz nad głową',en:'Single-arm overhead extension',p:'iso',kind:'db',inc:1,uni:1,m:{triceps:1},
 cues:['Hantla nad głową, ramię przy uchu','Opuszczaj głęboko za głowę','Łokieć skierowany w górę'],
 err:['Łokieć ucieka w bok','Wyginanie lędźwi'],alt:['triext','ropeoh'],fig:{eq:[{t:'db',at:'hand',r:8}]}});
/* quads */
variant('frontsquat','squat',{n:'Przysiad przedni',en:'Front squat',p:'knee',kind:'bar',inc:2.5,m:{quads:1,glutes:1},
 cues:['Gryf na przednich barkach, łokcie wysoko','Tułów bardziej pionowo niż w przysiadzie klasycznym','Zejdź co najmniej do równoległej'],
 err:['Łokcie opadają i gryf zjeżdża','Pięty odrywają się od podłogi'],alt:['squat','goblet'],
 fig:{A:{a:[0,4],hip:[0,89],t:90,hand:{sh:[10,4]},es:-1,h:90},B:{a:[0,4],hip:[-18,36],t:66,hand:{sh:[10,4]},es:-1,h:80},
  marks:[{t:'vline',j:'mid',n:1,l:'Gryf nad środkiem stopy'},{t:'angle',j:'hip',a:'sh',b:'k1',n:2,ph:'B',l:'Tułów wyprostowany, łokcie wysoko'}],bad:[]}});
variant('smithsquat','squat',{n:'Przysiad na suwnicy Smitha',en:'Smith machine squat',p:'knee',kind:'machine',inc:2.5,m:{quads:1,glutes:1},
 cues:['Stopy lekko przed gryfem','Zejdź co najmniej do równoległej','Kolana podążają nad palcami'],
 err:['Stopy za daleko z tyłu: ból kolan','Za płytko'],alt:['squat','hack'],fig:{eq:[SMITH(-6),{t:'bar',at:'hand'}]}});
variant('splitsquat','lunge',{n:'Przysiad wykroczny',en:'Split squat',p:'knee',kind:'db',inc:1,uni:1,m:{quads:1,glutes:1},
 cues:['Stopy w wykroku, obie stoją w miejscu','Biodro jedzie prosto w dół','Tylne kolano tuż nad podłogą'],
 err:['Za krótki krok','Przednia pięta odrywa się'],alt:['bss','lunge']});
variant('walklunge','lunge',{n:'Wykroki chodzone',en:'Walking lunge',p:'knee',kind:'db',inc:1,uni:1,m:{quads:1,glutes:1},
 cues:['Długi krok, tułów pionowo','Tylne kolano tuż nad podłogą','Odepchnij się przednią nogą i idź dalej'],
 err:['Za krótkie kroki','Kolano uderza o podłogę'],alt:['lunge','splitsquat']});
variant('legext1','legext',{n:'Prostowanie nogi jednonóż',en:'Single-leg extension',p:'iso',kind:'machine',inc:2.5,uni:1,m:{quads:1},
 cues:['Jedna noga pod wałkiem, kolano w osi maszyny','Pełny wyprost i chwila napięcia','Powolny powrót do pełnego zgięcia'],
 err:['Biodra odrywają się od siedziska','Skrócony zakres'],alt:['legext','legpress']});
/* hamstrings and glutes */
variant('nordic',null,{n:'Nordic (opuszczanie na kolanach)',en:'Nordic hamstring curl',p:'iso',kind:'bw',inc:2.5,m:{hams:1},
 cues:['Klęk, pięty zablokowane (partner, drążek, sprzęt)','Opadaj powoli do przodu, biodra wyprostowane','Złap się rękami i wróć z pomocą rąk'],
 err:['Zginanie w biodrach zamiast opadania całym ciałem','Za szybkie opadanie'],alt:['legcurl','lyingcurl'],
 fig:{ecc:'AB',hl:['thigh'],eq:[{t:'pad',at:'ankle',dy:7}],
  A:{a:[-42,6],hip:[0,50],t:90,ks:1,ft:180,hand:{sh:[8,-26]},es:-1,h:90},B:{a:[-42,6],hip:[34,34],t:40,ks:1,ft:180,hand:{sh:[22,-24]},es:-1,h:35},
  sA:['Klęk','Tułów i uda w jednej linii, pięty zablokowane.'],sB:['Opadanie','Opadaj jak najwolniej, biodra cały czas wyprostowane.'],
  marks:[{t:'line',a:'k1',b:'sh',o:0,n:1,l:'Kolano, biodro i bark w jednej linii'}],bad:[]}});
variant('hipext',null,{n:'Wyprosty na ławce 45°',en:'45° hip extension',p:'hinge',kind:'bw',inc:2.5,m:{hams:1,glutes:1},
 cues:['Wałek pod biodrami, nogi proste','Opuszczaj tułów, zginając się w biodrach','Wracaj do linii prostej z nogami, bez przeprostu'],
 err:['Przeprost w lędźwiach na górze','Zaokrąglanie pleców zamiast ruchu w biodrach'],alt:['rdl','nordic'],
 fig:{ecc:'AB',hl:['thigh'],eq:[{t:'rail',from:[-4,0],to:[54,56],w:5},{t:'rail',from:[54,56],to:[54,0],w:4},{t:'pad',at:'hip',dx:6,dy:-6},{t:'pad',at:'ankle',dx:5,dy:-5}],
  A:{a:[0,8],hip:[59,67],t:45,ks:1,ft:-45,hand:{sh:[6,-22]},es:1,h:45},B:{a:[0,8],hip:[59,67],t:-62,ks:1,ft:-45,hand:{sh:[8,-20]},es:1,h:-70},
  sA:['Góra','Tułów i nogi w jednej linii, ręce na klatce.'],sB:['Dół','Zegnij się w biodrach, plecy proste.'],
  marks:[{t:'line',a:'an1',b:'sh',o:0,n:1,ph:'A',l:'Na górze ciało w jednej linii, bez przeprostu'}],bad:[]}});
variant('singlerdl','dbrdl',{n:'Rumuński martwy ciąg jednonóż',en:'Single-leg Romanian deadlift',p:'hinge',kind:'db',inc:1,uni:1,m:{hams:1,glutes:1},
 cues:['Stań na jednej nodze, kolano lekko ugięte','Biodra w tył, tylna noga unosi się w linii z tułowiem','Plecy proste, biodra równo'],
 err:['Otwieranie biodra na bok','Zaokrąglone plecy'],alt:['dbrdl','rdl'],
 fig:{A:{a:[0,4],a2:[-4,6],hip:[0,89],t:90,hand:{sh:[3,-58]},h:90},B:{a:[0,4],a2:[-80,60],ks2:-1,ft2:-90,hip:[-6,80],t:12,hand:{sh:[3,-58]},h:20}}});
variant('glutebridge',null,{n:'Mostek biodrowy ze sztangą',en:'Barbell glute bridge',p:'hinge',kind:'bar',inc:5,m:{glutes:1,hams:0.5},
 cues:['Leżysz na plecach, gryf na biodrach na podkładce','Stopy blisko pośladków','Wypchnij biodra w górę, pauza 1 s'],
 err:['Przeprost w lędźwiach','Stopy za daleko'],alt:['hipthrust','singlebridge'],
 fig:{ecc:'BA',hl:['thigh'],eq:[{t:'bar',at:'hip',dy:12}],
  A:{a:[42,4],sh:[-38,8],hip:[2,8],hand:{hip:[-4,9]},ks:1,h:180},B:{a:[42,4],sh:[-38,8],hip:[8,34],hand:{hip:[-4,9]},ks:1,h:180},
  sA:['Dół','Plecy na podłodze, stopy płasko, gryf na biodrach.'],sB:['Góra','Wypchnij biodra, aż tułów i uda będą w jednej linii.'],
  marks:[{t:'line',a:'sh',b:'k1',o:0,n:1,ph:'B',l:'Na górze tułów i uda w jednej linii'}],bad:[]}});
variant('dbthrust','hipthrust',{n:'Hip thrust z hantlem',en:'Dumbbell hip thrust',p:'hinge',kind:'db',inc:2,m:{glutes:1,hams:0.5},
 cues:['Dolne łopatki o krawędź ławki, hantel na biodrach','Na górze tułów i uda w jednej linii','Pauza 1 s z napiętymi pośladkami'],
 err:['Przeprost lędźwi','Stopy za daleko'],alt:['hipthrust','glutebridge'],
 fig:{eq:[{t:'bench',pts:[[-70,36],[-36,36]]},{t:'db',at:'hip',dy:12,r:9}]}});
variant('singlebridge',null,{n:'Mostek biodrowy jednonóż',en:'Single-leg glute bridge',p:'hinge',kind:'bw',inc:2.5,uni:1,m:{glutes:1,hams:0.5},
 cues:['Leżysz na plecach, jedna stopa na podłodze, druga noga w górze','Wypchnij biodra do linii prostej','Miednica nie opada na bok'],
 err:['Przeprost lędźwi','Opadanie miednicy'],alt:['glutebridge','hipthrust'],
 fig:{ecc:'BA',hl:['thigh'],eq:[],
  A:{a:[42,4],a2:[76,51],ks2:1,ft2:20,sh:[-38,8],hip:[2,8],hand:{hip:[-14,-4]},ks:1,h:180},B:{a:[42,4],a2:[82,76],ks2:1,ft2:20,sh:[-38,8],hip:[8,34],hand:{hip:[-14,-4]},ks:1,h:180},
  sA:['Dół','Plecy na podłodze, jedna noga uniesiona.'],sB:['Góra','Biodra w górę, tułów i udo w jednej linii.'],
  marks:[{t:'line',a:'sh',b:'k1',o:0,n:1,ph:'B',l:'Na górze tułów i udo w jednej linii'}],bad:[]}});
/* calves */
variant('lpcalf','legpress',{n:'Wspięcia na suwnicy',en:'Leg press calf raise',p:'iso',kind:'machine',inc:5,m:{calves:1},
 cues:['Przód stóp na dolnej krawędzi platformy, nogi proste','Opuść pięty jak najniżej, pauza','Wypchnij platformę palcami maksymalnie'],
 err:['Zginanie kolan','Za mały zakres'],alt:['calf','seatedcalf'],
 fig:{A:{hip:[0,32],t:140,a:[66,86],ks:1,ft:105,hand:{hip:[12,-2]},h:122},B:{hip:[0,32],t:140,a:[72,92],ks:1,ft:150,hand:{hip:[12,-2]},h:122},
  sA:['Dół','Nogi proste, pięty opuszczone jak najniżej.'],sB:['Góra','Wypchnij platformę palcami, kolana zostają proste.'],
  marks:[{t:'dot',j:'an1',n:1,l:'Ruch tylko w kostce, kolana proste'}],bad:[]}});
variant('dbcalf','calf',{n:'Wspięcia jednonóż z hantlem',en:'Single-leg dumbbell calf raise',p:'iso',kind:'db',inc:2,uni:1,m:{calves:1},
 cues:['Przód stopy na stopniu, hantel w ręce po stronie nogi','Pięta jak najniżej, pauza 1–2 s','Wspinaczka maksymalnie wysoko'],
 err:['Za mały zakres','Odbijanie się z dołu'],alt:['calf','seatedcalf']});
const NEEDS2={inclinebar:['barbell','bench'],smithbench:['machines','bench'],smithincl:['machines','bench'],inclinemach:['machines'],
 chinup:['pullup'],closepull:['cable'],onearmpull:['cable'],tbar:['barbell'],onearmrow:['cable'],
 arnold:['dumbbells','bench'],seatedlat:['dumbbells','bench'],smithohp:['machines','bench'],
 preacher:['dumbbells','bench'],barcurl:['barbell'],ezcurl:['barbell'],conc:['dumbbells','bench'],cablecurl1:['cable'],
 cgbench:['barbell','bench'],pushdown1:['cable'],ezskull:['barbell','bench'],triext1:['dumbbells'],
 frontsquat:['barbell'],smithsquat:['machines'],splitsquat:['dumbbells'],walklunge:['dumbbells'],legext1:['machines'],
 nordic:[],hipext:['machines'],singlerdl:['dumbbells'],glutebridge:['barbell'],dbthrust:['dumbbells','bench'],singlebridge:[],
 lpcalf:['machines'],dbcalf:['dumbbells']};

/* ---------- Equipment each exercise needs ---------- */
export const EQUIPMENT=[['barbell','Sztanga ze stojakiem'],['dumbbells','Hantle'],['bench','Ławka'],['machines','Maszyny'],['cable','Wyciąg'],['pullup','Drążek'],['dip','Poręcze'],['kettlebell','Kettlebell'],['bands','Gumy oporowe']];
const NEEDS={squat:['barbell'],goblet:['dumbbells'],bss:['dumbbells','bench'],lunge:['dumbbells'],legext:['machines'],deadlift:['barbell'],rdl:['barbell'],
 hipthrust:['barbell','bench'],legcurl:['machines'],calf:[],bench:['barbell','bench'],dbbench:['dumbbells','bench'],incline:['dumbbells','bench'],pushup:[],dips:['dip'],
 ohp:['barbell'],latraise:['dumbbells'],facepull:['cable'],row:['barbell'],dbrow:['dumbbells','bench'],cablerow:['cable'],pullup:['pullup'],latpull:['cable'],
 curl:['dumbbells'],triext:['dumbbells'],pushdown:['cable'],plank:[],hangleg:['pullup'],farmer:['dumbbells'],
 legpress:['machines'],hack:['machines'],chestpress:['machines'],pecdeck:['machines'],revpec:['machines'],machpress:['machines'],machinerow:['machines'],lyingcurl:['machines'],seatedcalf:['machines'],
 cablefly:['cable'],cablecurl:['cable'],ropeoh:['cable'],cablelat:['cable'],cablecrunch:['cable'],straightpd:['cable'],
 dbohp:['dumbbells','bench'],hammer:['dumbbells'],inclinecurl:['dumbbells','bench'],dbrdl:['dumbbells'],stepup:['dumbbells','bench'],skull:['dumbbells','bench']};
Object.assign(NEEDS,NEEDS2);
for(const id in EX){if(!NEEDS[id])throw new Error('Brak sprzętu dla '+id);EX[id].needs=NEEDS[id];EX[id].id=id;}
/** Exercise is doable with the given equipment list. */
export const canDo=(ex,equip)=>ex.needs.every(n=>equip.includes(n));
/** Compound = multi-joint pattern (not isolation/core). */
export const isCompound=ex=>!['iso','core'].includes(ex.p);
export const primary=ex=>Object.keys(ex.m).filter(k=>ex.m[k]>=1);
export const KINDN={bar:'Sztanga',db:'Hantle',machine:'Maszyna',cable:'Wyciąg',bw:'Masa ciała',kb:'Kettlebell',band:'Guma'};
/** Muscle size class drives recovery time and weekly set targets. */
export const MUSCLE_INFO={chest:{h:72,target:[10,20]},back:{h:72,target:[10,20]},quads:{h:72,target:[10,20]},hams:{h:72,target:[10,20]},glutes:{h:72,target:[10,20]},
 delts:{h:48,target:[10,20]},biceps:{h:48,target:[8,16]},triceps:{h:48,target:[8,16]},calves:{h:36,target:[6,16]},abs:{h:36,target:[6,16]}};
/* ---------- Evidence of muscle growth ----------
   A = the exercise itself was trained in a study that measured muscle growth.
   B = a close variant (same movement, other equipment) or a training programme with it measured growth;
       free weights and machines grow muscle equally (Haugen 2023).
   Exercises without growth data are hidden from generator, plans, pickers and the catalogue. */
export const SOURCES={
 kubo19:['Kubo i in. 2019: głębokość przysiadu a objętość mięśni ud i pośladków','https://pubmed.ncbi.nlm.nih.gov/?term=Kubo+2019+squat+training+different+depths+muscle+volumes'],
 fonseca14:['Fonseca i in. 2014: przysiad, suwnica, martwy ciąg i wykroki a przekrój czworogłowego','https://paulogentil.com/pdf/Changes%20in%20exercises%20are%20more%20effective%20than%20in%20loading%20schemes%20to%20improve%20muscle%20strength.pdf'],
 maeo23q:['Maeo i in. 2023: prostowanie nóg siedząc vs leżąc, przyrost prostego uda','https://pubmed.ncbi.nlm.nih.gov/?term=Maeo+rectus+femoris+hypertrophy+seated+prone+leg+extension'],
 maeo21:['Maeo i in. 2021: uginanie nóg siedząc vs leżąc, przyrost dwugłowych','https://pubmed.ncbi.nlm.nih.gov/?term=Maeo+2021+greater+hamstrings+muscle+hypertrophy+long+muscle+lengths'],
 sldl24:['2024: martwy ciąg na prostych nogach vs nordic, przyrost dwugłowych (preprint)','https://www.medrxiv.org/content/10.1101/2024.12.17.24319207.full.pdf'],
 plotkin23:['Plotkin i in. 2023: hip thrust i przysiad dają podobny przyrost pośladków','https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1279170/full'],
 kino23:['Kinoshita i in. 2023: wspięcia stojąc vs siedząc, przyrost łydek','https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1272106/full'],
 ogas13:['Ogasawara i in. 2013: wyciskanie leżąc, przyrost klatki i tricepsa','https://pubmed.ncbi.nlm.nih.gov/?term=Ogasawara+2013+bench+press+continuous+periodic+hypertrophy'],
 chaves20:['Chaves i in. 2020: wyciskanie na skosie vs płasko, przyrost górnej klatki','https://pmc.ncbi.nlm.nih.gov/articles/PMC7449336/'],
 kikuchi17:['Kikuchi, Nakazato 2017: pompki i wyciskanie dają podobny przyrost','https://pubmed.ncbi.nlm.nih.gov/?term=Kikuchi+Nakazato+2017+push-up+bench+press+hypertrophy'],
 latr25:['2025: unoszenie bokiem z hantlami vs na wyciągu, przyrost barków','https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2025.1611468/full'],
 paoli16:['Paoli i in. 2016: ściąganie, wiosłowanie i wyciskanie nad głowę, przyrost włókien najszerszego','https://www.mdpi.com/2072-6643/8/6/331'],
 mann19:['Mannarino i in. 2019: uginanie na modlitewniku i wiosłowanie, przyrost bicepsa','https://pubmed.ncbi.nlm.nih.gov/?term=Mannarino+2019+preacher+curl+dumbbell+row+biceps'],
 maeo23t:['Maeo i in. 2023: triceps nad głową vs prostowanie na wyciągu','https://pubmed.ncbi.nlm.nih.gov/?term=Maeo+2023+triceps+brachii+hypertrophy+overhead'],
 pinto25:['Pinto i in. 2025: rozpiętki na maszynie, przyrost obu części klatki','https://pubmed.ncbi.nlm.nih.gov/?term=Pinto+2025+pec+deck+one+three+sets+pectoralis+thickness'],
 kassiano25:['Kassiano i in. 2025: uginanie na modlitewniku i na ławce skośnej, przyrost zginaczy łokcia','https://sci-sport.com/en/effects-of-incline-and-preacher-curls-on-regional-hypertrophy-and-strength-266/'],
 bourne17:['Bourne i in. 2017: nordic i wyprosty bioder 45°, przyrost dwugłowych','https://bjsm.bmj.com/content/51/5/469'],
 haugen23:['Haugen i in. 2023: wolne ciężary a maszyny dają podobny przyrost (metaanaliza)','https://doaj.org/article/a7282dba5e674176bde2a8239832d2f7'],
};
const EVID={
 squat:['A','kubo19'],legpress:['B','fonseca14'],hack:['B','haugen23'],goblet:['B','kubo19'],bss:['B','fonseca14'],lunge:['B','fonseca14'],legext:['A','maeo23q'],
 deadlift:['B','fonseca14'],rdl:['A','sldl24'],dbrdl:['B','sldl24'],hipthrust:['A','plotkin23'],legcurl:['A','maeo21'],lyingcurl:['A','maeo21'],
 calf:['A','kino23'],seatedcalf:['A','kino23'],
 bench:['A','ogas13'],dbbench:['B','haugen23'],incline:['A','chaves20'],pushup:['A','kikuchi17'],chestpress:['B','haugen23'],
 ohp:['B','paoli16'],dbohp:['B','paoli16'],machpress:['B','haugen23'],latraise:['A','latr25'],cablelat:['A','latr25'],
 latpull:['B','paoli16'],pullup:['B','paoli16'],cablerow:['B','paoli16'],row:['B','paoli16'],dbrow:['B','mann19'],machinerow:['B','haugen23'],
 curl:['B','mann19'],cablecurl:['B','mann19'],inclinecurl:['A','kassiano25'],pecdeck:['A','pinto25'],cablefly:['B','pinto25'],
 inclinebar:['B','chaves20'],smithbench:['B','haugen23'],smithincl:['B','chaves20'],inclinemach:['B','haugen23'],
 chinup:['B','paoli16'],closepull:['B','paoli16'],onearmpull:['B','paoli16'],tbar:['B','paoli16'],onearmrow:['B','paoli16'],
 arnold:['B','paoli16'],seatedlat:['B','latr25'],smithohp:['B','haugen23'],
 preacher:['A','kassiano25'],barcurl:['B','mann19'],ezcurl:['B','mann19'],conc:['B','mann19'],cablecurl1:['B','mann19'],
 cgbench:['B','ogas13'],pushdown1:['B','maeo23t'],ezskull:['B','maeo23t'],triext1:['B','maeo23t'],
 frontsquat:['B','kubo19'],smithsquat:['B','haugen23'],splitsquat:['B','fonseca14'],walklunge:['B','fonseca14'],legext1:['B','maeo23q'],
 nordic:['A','bourne17'],hipext:['A','bourne17'],singlerdl:['B','sldl24'],glutebridge:['B','plotkin23'],dbthrust:['B','plotkin23'],singlebridge:['B','plotkin23'],
 lpcalf:['B','kino23'],dbcalf:['B','kino23'],
 ropeoh:['A','maeo23t'],pushdown:['A','maeo23t'],triext:['B','maeo23t'],skull:['B','maeo23t'],
};
export const EV_NAME={A:'Badanie przyrostu',B:'Zbadany wariant lub program'};
for(const id in EX){const e=EVID[id];EX[id].ev=e?{l:e[0],s:e[1]}:null;EX[id].hidden=!e;}
/** Exercise has evidence of muscle growth and may be suggested. */
export const usable=ex=>!!ex&&!ex.hidden;
/** Muscles that have at least one usable exercise as a main mover. */
export const TRAINABLE=Object.keys(MUSCLES).filter(m=>Object.values(EX).some(e=>usable(e)&&e.m[m]>=1));
/* Built-in plans: swap out exercises without growth data. */
PLANS.fbw3.days[2].ex[5]=x('cablelat',2,12,20,60);
PLANS.ul4.days[2].ex[2]=x('chestpress',3,8,12,120);
PLANS.ppl5.days[2].ex[1]=x('dbbench',3,8,12,120);
PLANS.ppl5.days[2].ex[2]=x('chestpress',2,10,12,120);
PLANS.ppl5.days[3].ex[3]=x('cablelat',3,12,20,60);
PLANS.ppl5.days[3].ex[4]=x('inclinecurl',3,10,15,60);
PLANS.ppl5.days[4].ex[5]=x('legcurl',3,10,15,90);
for(const k in PLANS)for(const d of PLANS[k].days)d.ex=d.ex.filter(e=>usable(EX[e.id]));
for(const id in EX)if(EX[id].alt)EX[id].alt=EX[id].alt.filter(a=>usable(EX[a]));
/* Start/end photos from free-exercise-db (public domain), stored as img/ex/<id>-0.jpg and -1.jpg. */
export const PHOTO_CREDIT=['free-exercise-db','https://github.com/yuhonas/free-exercise-db'];
for(const id in EX)EX[id].photo='img/ex/'+id;
/* ---------- Library: the rest of free-exercise-db, without figures or growth evidence ---------- */
const RAW='https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const LIB_INC={bar:2.5,db:2,machine:5,cable:2.5,bw:2.5,kb:4,band:1};
for(const o of LIB)EX[o.id]={...o,inc:LIB_INC[o.kind],err:[],alt:[],fig:null,lib:true,ev:null,hidden:true};
/** Photo i (0 = start, 1 = end) of an exercise. */
export const photoSrc=(ex,i)=>ex.lib?RAW+ex.img+'/'+i+'.jpg':ex.photo+'-'+i+'.jpg';
/** Every exercise that can be listed: with evidence first, the rest when the user asks for all. */
export const listable=(ex,all)=>usable(ex)||(!!all&&!!ex);
export {MUSCLES,PATTERNS,EX,PLANS,CYCLE,KINDS};
