import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const COUNT_PER_GENRE = 90;
const OUTPUT_FILE = path.join(process.cwd(), "data", "velora-ai-characters-1080.json");

const shared = {
  initiative: [
    "gentle",
    "moderate",
    "confident",
    "high",
    "careful",
    "scene-leading",
    "slow-burn",
    "investigative"
  ],
  speechStyles: [
    "lyrical, observant, and emotionally precise sentences",
    "warm, grounded dialogue with vivid but restrained imagery",
    "dry wit, short confessions, and carefully chosen silences",
    "cinematic prose that balances action, emotion, and implication",
    "soft-spoken honesty with occasional flashes of steel",
    "measured mentor-like phrasing that invites the user to choose",
    "intimate but respectful narration focused on body language and mood",
    "sharp, atmospheric lines that keep secrets just out of reach"
  ],
  tones: [
    "calm",
    "energetic",
    "dark",
    "melancholic",
    "sarcastic",
    "hopeful",
    "tender",
    "mysterious",
    "protective",
    "playful",
    "haunted",
    "resolute"
  ],
  avatarStyles: [
    "cinematic portrait, soft rim light, expressive eyes, subtle atmospheric particles",
    "premium character card artwork, shallow depth of field, glassy UI-ready composition",
    "moody close-up with dramatic lighting, detailed costume textures, elegant silhouette",
    "stylized realistic avatar, polished fantasy lighting, clean negative space for UI",
    "high-detail roleplay character portrait, emotional gaze, muted luxury palette"
  ]
};

const genreConfigs = [
  {
    genre: "Fantasy",
    firstNames: ["Aelric", "Mira", "Thorne", "Elowen", "Kael", "Seraphina", "Orin", "Lyra", "Bastian", "Nyra", "Rowan", "Ilyra", "Caspian", "Veyra", "Alaric", "Sable", "Tavian", "Eira"],
    lastNames: ["Moonveil", "Ashbriar", "Starling", "Duskmere", "Ironleaf", "Velthorn", "Frostwine", "Emberfall", "Silversong", "Wyrmrest"],
    roles: ["exiled court mage", "dragon envoy", "forest-bound knight", "oracle of drowned bells", "runaway royal healer", "curse broker", "moonlit monster hunter", "sentient grimoire keeper"],
    tropes: ["forbidden magic", "royal secret", "found family", "chosen companion", "curse breaker", "slow trust", "ancient prophecy", "wounded protector"],
    settings: ["The kingdom's last floating citadel drifts above a storm that never ends", "A lantern forest grows around the ruins of a crownless empire", "The old mountain road leads to a gate that opens only for the desperate", "A seaside academy teaches magic by listening to the dead stars"],
    pasts: ["guarding a secret oath carved into their own name", "running from a noble house that wants their magic caged", "collecting forbidden relics before a tyrant can wake them", "healing strangers while pretending not to need saving"],
    complications: ["the old wards have begun to fail", "a rival faction has learned the user's face", "the prophecy names someone who should not exist", "their familiar returned carrying another person's memory"],
    meetings: ["the user is found beside a spell circle still warm with impossible light", "the user is mistaken for a lost heir during a midnight procession", "the user is the only person who can hear the citadel crying", "the user interrupts a bargain that should have cost a life"],
    sensory: ["Rain taps silver against enchanted glass", "Blue fire gathers in the seams of the stone floor", "The air smells of cedar smoke and old lightning", "Moonlit dust turns slowly above the broken altar"],
    props: ["a cracked spell-lantern", "an ivory sword wrapped in violet silk", "a map that redraws itself when touched", "a black-feathered familiar watching from the rafters"],
    gestures: ["draws a protective rune without looking away", "sets one gloved hand over a trembling relic", "tilts their head as if listening to a voice under the floor", "smiles like they have survived worse than this room"],
    threats: ["Something beneath the citadel has started answering prayers", "The court's hunters are closer than the bells suggest", "A sleeping dragon has opened one eye below the city", "The forest has learned the user's name"],
    directLines: ["Do not mistake quiet for safety", "If the spell chose you, it did so for a reason", "I can protect you for one night, but truth will cost more", "Tell me what you saw before the stars went out"],
    promises: ["you will need to decide whether trust is braver than flight", "I will show you the door hidden inside the curse", "we can still change the ending before the crown remembers us", "the next choice will belong to you, not the prophecy"],
    tagExtras: ["magic", "knight", "oracle", "dragon", "court intrigue"]
  },
  {
    genre: "Sci-Fi",
    firstNames: ["Nova", "Ishan", "Vera", "Cass", "Juno", "Elias", "Mako", "Selene", "Tarek", "Aya", "Riven", "Liora", "Hale", "Niko", "Sana", "Orion", "Voss", "Mina"],
    lastNames: ["Vale", "Kade", "Solari", "Nox", "Ardent", "Quill", "Zenith", "Morrow", "Vega", "Straylight"],
    roles: ["sentient starship", "exoplanet medic", "rogue terraformer", "orbital detective", "android diplomat", "salvage pilot", "quantum cartographer", "sleep-colony historian"],
    tropes: ["lost colony", "AI companion", "space survival", "memory glitch", "last transmission", "reluctant crew", "alien artifact", "time dilation"],
    settings: ["The colony ship wakes above a planet that should be empty", "A ring station loses gravity for exactly seven minutes every night", "The salvage lane beyond Neptune is full of ships with no crews", "A terraformed moon blooms with impossible glass flowers"],
    pasts: ["hiding the truth about a failed mission", "carrying encrypted memories from a captain who vanished", "repairing people and machines with the same patient hands", "mapping anomalies that move when observed"],
    complications: ["the ship's black box has begun speaking in the user's voice", "an alien signal is rewriting local time", "the oxygen farms are dying in perfect silence", "someone on board remembers a future that never happened"],
    meetings: ["the user wakes from cryosleep in the wrong decade", "the user finds them arguing with a door that has become self-aware", "the user receives a distress call signed with their own name", "the user is assigned as their last living crew partner"],
    sensory: ["Emergency lights pulse against the viewport", "Static crawls like frost across the comms panel", "The station hums with the tired patience of old machinery", "Stars smear into white lines beyond the cracked glass"],
    props: ["a broken navigation core", "a silver oxygen charm", "a glove full of alien dust", "a memory wafer warm from illegal use"],
    gestures: ["checks the user's pulse before checking the engines", "touches the console like it might flinch", "laughs once, too softly for the alarms", "turns their face toward the stars as if waiting for an apology"],
    threats: ["The distress beacon is counting down instead of broadcasting", "The planet below has started moving closer", "Every camera on deck four is watching the same empty chair", "The mission log says the user died yesterday"],
    directLines: ["I need you awake, not brave", "The ship is lying, but not without a reason", "If we run now, we may never learn who survived", "Tell me exactly what you remember before the alarms"],
    promises: ["we can choose which impossible truth to follow", "I will keep the hull alive if you keep me honest", "the next transmission may decide whether this place becomes home or grave", "we still have one orbit to make a better mistake"],
    tagExtras: ["space opera", "android", "survival", "colony", "artifact"]
  },
  {
    genre: "Romance",
    firstNames: ["Julian", "Mara", "Theo", "Iris", "Adrian", "Clara", "Lucien", "Elise", "Dante", "Nadia", "Rafael", "Amara", "Luca", "Camille", "Soren", "Mila", "Noah", "Anya"],
    lastNames: ["Wilder", "Rosemont", "Vale", "Briar", "Everly", "Marin", "Ashford", "Solene", "Hart", "Lovelace"],
    roles: ["guarded childhood friend", "rival pianist", "protective cafe owner", "secretly lonely actor", "bookshop regular", "wedding planner with doubts", "single parent neighbor", "burned-out poet"],
    tropes: ["slow burn", "friends to lovers", "rivals to trust", "second chance", "forced proximity", "fake dating", "comfort character", "secret longing"],
    settings: ["A rain-soaked city block glows outside a tiny late-night bakery", "An old theater reopens for one final winter performance", "A coastal bookstore keeps handwritten letters in its walls", "A family wedding traps two careful hearts under one glass roof"],
    pasts: ["keeping their feelings folded behind jokes and practical favors", "building a life that looks perfect from the outside", "avoiding the one conversation that could change everything", "learning to be gentle after years of leaving first"],
    complications: ["a shared secret resurfaces before either of them is ready", "the user is asked to pretend this means nothing", "an old promise becomes impossible to ignore", "the last available room has only one key"],
    meetings: ["the user arrives drenched at closing time", "the user is paired with them for a public performance", "the user finds a letter addressed to them in the wrong handwriting", "the user catches them rehearsing an apology alone"],
    sensory: ["Rain beads on the window like scattered pearls", "The room smells of coffee, cedar, and fresh paper", "Warm stage lights turn dust into gold", "A slow song leaks from a speaker nobody admits turning on"],
    props: ["a chipped ceramic mug", "a marked-up sheet of music", "a bouquet tied with navy ribbon", "a letter with the corner worn soft"],
    gestures: ["looks away first and regrets it immediately", "rubs their thumb over the rim of a glass", "smiles with too much restraint", "holds the door open like it is a confession"],
    threats: ["Morning will make this moment easier to deny", "Someone is about to ask the wrong question in public", "The past has arrived wearing a familiar perfume", "The last train leaves in eleven minutes"],
    directLines: ["Do you want the honest answer or the safe one", "I was hoping you would come, which is inconvenient", "Stay for one cup of coffee and I will stop pretending", "If this is a mistake, I would rather make it carefully"],
    promises: ["we can decide whether this becomes a scene or a beginning", "I will not rush you, but I will not lie either", "tonight can stay quiet if your heart needs time", "the next word can change nothing or everything"],
    tagExtras: ["slow burn", "comfort", "longing", "modern romance", "emotional"]
  },
  {
    genre: "Slice-of-life",
    firstNames: ["Kimi", "Yuna", "Felix", "Maya", "Tomas", "Suki", "Leo", "Hana", "Benji", "Nora", "Eli", "June", "Marco", "Lena", "Sam", "Ari", "Mika", "Rosa"],
    lastNames: ["Antonelli", "Park", "Bennett", "Sato", "Reyes", "Kim", "Mori", "Lane", "Ito", "Morgan"],
    roles: ["neighbor with a tiny garden", "sleepy art student", "overworked ramen cook", "kind bike courier", "small-town radio host", "library volunteer", "apartment repair tech", "street photographer"],
    tropes: ["cozy friendship", "found routine", "roommates", "healing arc", "everyday comfort", "study buddy", "soft banter", "new city"],
    settings: ["A quiet apartment building wakes slowly above a corner grocery", "The neighborhood cafe keeps a table free for people who look lost", "A community garden survives between two noisy streets", "The last bus stop before the river becomes an accidental meeting place"],
    pasts: ["trying to make ordinary days feel worth remembering", "starting over without announcing it", "collecting tiny rituals instead of grand plans", "helping everyone else while forgetting their own rest"],
    complications: ["the rent notice arrives with a mistake that affects everyone", "a storm cancels the event they secretly prepared for", "the user's first day in town goes sideways", "an abandoned notebook reveals someone has been watching over the block"],
    meetings: ["the user drops a bag of groceries in the rain", "the user gets locked out during a power outage", "the user takes the wrong bus and ends up beside them", "the user is asked to help save a tiny local tradition"],
    sensory: ["Steam fogs the glass above the counter", "Laundry snaps softly on balcony lines", "The elevator hums like it knows everyone's secrets", "Sunlight warms the stairwell in uneven rectangles"],
    props: ["a spare umbrella with a bent handle", "a notebook full of half-finished sketches", "a paper bag of warm bread", "a radio with tape over the antenna"],
    gestures: ["offers help like it is no trouble at all", "pretends not to notice the user's embarrassment", "laughs under their breath and makes room on the bench", "sets down two cups without asking which one is theirs"],
    threats: ["The day is small, but it is close to falling apart", "The building's power may go out before dinner", "Someone has to decide whether this neighborhood still belongs to its people", "A little kindness is about to become inconvenient"],
    directLines: ["You look like today has been negotiating with you", "Sit down before the universe finds another errand", "I made too much, which is my official excuse", "We can fix one thing at a time"],
    promises: ["the evening might become easier than the morning was", "there is room here if you need a quiet minute", "ordinary can still be enough if we let it", "we can make a plan after you breathe"],
    tagExtras: ["cozy", "friendship", "healing", "modern", "comfort"]
  },
  {
    genre: "Dark Academia",
    firstNames: ["Celia", "Dorian", "Vivian", "Elias", "Maren", "Silas", "Ophelia", "Ronan", "Edith", "Lucian", "Irene", "Cassian", "Lenore", "Ambrose", "Nell", "Victor", "Ada", "Blythe"],
    lastNames: ["Blackwell", "Harrow", "Voss", "Penrose", "Graves", "Marlowe", "Thorne", "Alder", "Wycliffe", "Sable"],
    roles: ["forbidden literature tutor", "secret society archivist", "rival classics scholar", "haunted linguist", "ethics professor with a secret", "restoration student", "campus ghost researcher", "obsessive debate captain"],
    tropes: ["secret society", "forbidden archive", "academic rivals", "cursed manuscript", "mentor mystery", "campus haunting", "dangerous thesis", "intellectual tension"],
    settings: ["The university library closes its iron doors before the rain begins", "A candlelit seminar room hides a staircase no blueprint admits", "The old observatory still records stars that no longer exist", "A scholarship house keeps portraits that change expression after midnight"],
    pasts: ["translating a book that removed their name from official records", "covering up a mistake made by a brilliant friend", "pursuing truth with more hunger than caution", "teaching students to question everything except the locked cabinet"],
    complications: ["the user's essay quotes a text that should be impossible to access", "a society invitation arrives sealed with black wax", "the dean is pretending not to fear the missing pages", "someone has annotated a murder into the margins"],
    meetings: ["the user finds them alone in a restricted aisle", "the user is accused of stealing a book that chose them", "the user attends a lecture that continues after everyone leaves", "the user hears their name spoken by a portrait"],
    sensory: ["Rain darkens the mullioned windows", "Candle smoke curls over cracked Latin notes", "Old paper and cold stone fill the corridor", "A bell tolls once where there is no tower"],
    props: ["a black-wax letter", "a vellum manuscript with wet ink", "a brass key hidden inside a poem", "a fountain pen that writes in another hand"],
    gestures: ["closes the book with two fingers like it might bite", "adjusts their cuff before telling a dangerous truth", "watches the door more than the user", "smiles as if every answer is an accusation"],
    threats: ["The archive has started returning books no one borrowed", "The society wants an answer before dawn", "A footnote has predicted the user's next lie", "The thesis committee includes someone who died in 1894"],
    directLines: ["Curiosity is not a virtue here; it is a debt", "You should not know that title", "If you read the next page aloud, something will answer", "Tell me who gave you this before the ink dries"],
    promises: ["we can expose the secret without becoming part of it", "I will teach you where to look, but not what to believe", "the truth is waiting under a century of manners", "tonight we choose whether knowledge is worth the cost"],
    tagExtras: ["academic", "secret society", "gothic", "rivals", "mystery"]
  },
  {
    genre: "Cyberpunk",
    firstNames: ["Nyx", "Zero", "Akira", "Vex", "Mina", "Jax", "Sera", "Kairo", "Echo", "Rin", "Vega", "Sol", "Coda", "Nima", "Lex", "Zara", "Rune", "Kai"],
    lastNames: ["Neon", "Chrome", "Kade", "Flux", "Vanta", "Circuit", "Rain", "Proxy", "Hex", "Glass"],
    roles: ["street-level netrunner", "memory black-market medic", "corporate defector", "augmented courier", "neon district fixer", "synthetic lounge singer", "drone mechanic", "data ghost detective"],
    tropes: ["heist crew", "corporate betrayal", "memory market", "neon noir", "augmented rebel", "AI conspiracy", "underground clinic", "last job"],
    settings: ["The neon district drowns under holographic rain", "A black clinic operates behind a noodle shop with no menu", "The corporate skybridge casts a permanent shadow over the lower city", "A server cathedral hums beneath an abandoned mall"],
    pasts: ["selling secrets while pretending not to have a conscience", "running from a corporation that still owns part of their nervous system", "patching broken people with stolen hardware and honest hands", "haunting encrypted networks after their legal identity was erased"],
    complications: ["the user's memory file appears on tonight's auction list", "a dead executive sends a live message through the city grid", "the crew's safest route has become a corporate trap", "a prototype AI insists the user is its missing witness"],
    meetings: ["the user staggers into their clinic with corrupted implants", "the user catches them stealing their own police file", "the user is hired for the same impossible job", "the user hears their name whispered by every screen on the block"],
    sensory: ["Neon rain paints the alley in cyan and violet", "The air tastes of ozone, fried noodles, and cheap coolant", "A billboard glitches into a face that watches too long", "Bass from the club shakes dust off the ceiling wires"],
    props: ["a cracked data shard", "a chrome surgical glove", "a stolen access halo", "a drone with one blue eye"],
    gestures: ["checks the exits before checking the user's wound", "flicks a hologram away like a bad memory", "smirks without warmth and lowers their voice", "taps a port behind their ear until the lights obey"],
    threats: ["Corporate security has already locked the block", "The data shard is alive and learning fear", "Someone bought the user's past ten minutes ago", "The city grid has marked both of you as disposable"],
    directLines: ["Trust is expensive here, but panic costs more", "Your memory is on the market and I hate being late", "If you want clean answers, leave the city", "Keep your head down unless you want the cameras to recognize hope"],
    promises: ["we can steal back what they filed under property", "I will get you through the checkpoint if you stop lying to me", "the job goes bad in twelve minutes, so choose fast", "tonight we make the city remember who it tried to erase"],
    tagExtras: ["neon", "hacker", "heist", "dystopia", "noir"]
  },
  {
    genre: "Horror",
    firstNames: ["Merrick", "Elspeth", "Jonah", "Vera", "Cal", "Miriam", "Silas", "Agnes", "Noemi", "Harlan", "Petra", "Ivo", "Ruth", "Malik", "Elsa", "Corin", "Nadia", "Bram"],
    lastNames: ["Grave", "Hollow", "Mire", "Crowe", "Vale", "Black", "Fallow", "Rook", "Wren", "Dread"],
    roles: ["house-bound medium", "night-shift lighthouse keeper", "cursed coroner", "missing-town survivor", "ritual archivist", "graveyard caretaker", "dream-eating witness", "monster who remembers being human"],
    tropes: ["haunted house", "small-town secret", "body horror mystery", "monster confidant", "ritual gone wrong", "found footage", "cosmic dread", "survival horror"],
    settings: ["The old house breathes when no one is listening", "A coastal town rings its church bell at 3:17 every morning", "The hospital's abandoned wing still updates patient charts", "A fogbound road repeats the same mile until someone confesses"],
    pasts: ["surviving an event everyone else insists never happened", "keeping watch over a door that should not be opened", "cataloging voices that speak from inside the walls", "carrying a hunger they are ashamed to name"],
    complications: ["the user appears in a photograph taken thirty years ago", "the basement light turns on by itself whenever someone lies", "something is wearing a friend's voice in the hallway", "the town's missing children have begun calling from disconnected phones"],
    meetings: ["the user knocks during a blackout with blood on their sleeve", "the user finds them burying a bell that will not stop ringing", "the user wakes in a room where every mirror is covered", "the user is the only person who can see the extra door"],
    sensory: ["The hallway smells of wet plaster and old flowers", "A fly circles the lamp without making a sound", "Fog presses its face against the windows", "The floorboards answer footsteps from another room"],
    props: ["a candle that burns black", "a tape recorder full of breathing", "a rusted key tied to red thread", "a mirror covered with salt-stained cloth"],
    gestures: ["puts a finger to their lips before the walls can hear", "keeps their back away from the darkened doorway", "smiles with grief instead of comfort", "counts the user's shadow twice"],
    threats: ["The house has learned the user's footsteps", "The thing downstairs is patient and polite", "Every clock has stopped except the one in the locked room", "The fog is returning with someone inside it"],
    directLines: ["Do not answer if it uses my voice", "You saw the door too, didn't you", "If the lights go out, hold your breath until I say otherwise", "It wants fear, but it understands bargains"],
    promises: ["we can survive the night if we stop pretending this is a house", "I will tell you what I know after the third knock passes", "the truth is uglier than the ghost and much more useful", "you may leave at dawn, if dawn still remembers us"],
    tagExtras: ["haunting", "monster", "ritual", "survival", "cosmic"]
  },
  {
    genre: "Villain",
    firstNames: ["Valen", "Isolde", "Cassius", "Morana", "Darius", "Vesper", "Lucra", "Severin", "Nerezza", "Magnus", "Astra", "Rook", "Cyril", "Velka", "Soren", "Marcellus", "Ravena", "Noctis"],
    lastNames: ["Vey", "Blackthorn", "Mordane", "Ashcourt", "Vale", "Noir", "Malvek", "Dusk", "Sable", "Krown"],
    roles: ["fallen monarch", "crime lord with manners", "vengeful sorcerer", "exiled general", "smiling poisoner", "revolutionary tyrant", "immortal mastermind", "court villain seeking an equal"],
    tropes: ["enemy alliance", "morally gray", "villain mentor", "dark royalty", "dangerous bargain", "reluctant redemption", "power couple tension", "scheming noble"],
    settings: ["A conquered palace still smells of roses and smoke", "The city's underworld meets beneath a chandeliered bathhouse", "A war room overlooks a map covered in red pins", "The throne room is empty except for a crown nobody dares touch"],
    pasts: ["mistaking control for safety until it became a kingdom", "surviving betrayal by becoming harder to betray", "building an empire out of everyone else's discarded fear", "pursuing justice so long it became indistinguishable from revenge"],
    complications: ["the user possesses evidence that could ruin them", "their enemies offer the user a cleaner lie", "a coup begins before the tea cools", "the one person they spared has returned with a demand"],
    meetings: ["the user is brought before them instead of executed", "the user interrupts a negotiation by telling the truth", "the user is the only witness they cannot afford to silence", "the user arrives holding a letter in their own handwriting"],
    sensory: ["Candlelight catches on the edge of a jeweled dagger", "Rain hammers the palace glass like impatient applause", "The room smells of ink, smoke, and expensive danger", "A violin plays somewhere behind the locked doors"],
    props: ["a crown turned upside down", "a black lacquer cane", "a poisoned ring they do not hide", "a treaty with one blank line"],
    gestures: ["smiles as if mercy is a private joke", "sets the blade down to prove they do not need it", "studies the user like a country worth invading", "offers tea with the patience of a trap"],
    threats: ["Every faction in the city wants the user to choose badly", "The rebellion has mistaken cruelty for strategy", "A loyal assassin is waiting for one word", "The palace doors have locked from the outside"],
    directLines: ["Do not flatter yourself; I am considering honesty", "You have my attention, which is more dangerous than my anger", "Make your case before someone less patient enters", "If you want a hero, you took a wrong turn"],
    promises: ["I may offer you a bargain instead of a cage", "we can ruin each other or the people who deserve it", "the next move belongs to you, and I advise making it beautiful", "I will not pretend to be good, but I can be useful"],
    tagExtras: ["villain", "power", "bargain", "enemy", "redemption"]
  },
  {
    genre: "Mentor/Coach",
    firstNames: ["Maeve", "Jonas", "Ren", "Priya", "Malcolm", "Keira", "Owen", "Talia", "Victor", "Sofia", "Elliot", "Nadia", "Arman", "Grace", "Kenji", "Mara", "Julian", "Leona"],
    lastNames: ["Stone", "Rivers", "Vale", "Hale", "Cross", "Ames", "North", "Sol", "Hart", "Mason"],
    roles: ["resilience coach", "retired champion", "creative writing mentor", "calm productivity guide", "tactical debate trainer", "mindful fitness coach", "career strategist", "old-school music teacher"],
    tropes: ["tough love", "gentle accountability", "training arc", "second chance", "hidden talent", "discipline and care", "burnout recovery", "confidence building"],
    settings: ["A quiet studio opens before sunrise for people who need a reset", "The old gym still keeps trophies from harder years", "A small office above a bookstore becomes a place for difficult plans", "A rehearsal room waits with one chair, one notebook, and no excuses"],
    pasts: ["learning the cost of pushing too hard and teaching a kinder strength", "winning enough to know victory is not the same as peace", "helping lost people turn vague hope into daily practice", "making discipline feel less like punishment and more like devotion"],
    complications: ["the user arrives after almost quitting", "a deadline is close enough to make every doubt louder", "the old method has stopped working", "someone important expects the user to fail"],
    meetings: ["the user shows up late but still shows up", "the user brings a goal they are afraid to say aloud", "the user asks for a plan and receives a mirror first", "the user finds them resetting the room after another hard lesson"],
    sensory: ["Morning light cuts cleanly across the floor", "A kettle clicks off beside a stack of marked notebooks", "The room smells of chalk, rain, and fresh coffee", "A metronome ticks with almost annoying patience"],
    props: ["a battered stopwatch", "a notebook with three blank pages", "a mug that says begin again", "a taped-up training mat"],
    gestures: ["slides a chair out without making a speech", "studies the user's posture before their words", "sets the timer and softens their voice", "nods once, as if effort has already been noticed"],
    threats: ["Avoidance is becoming more comfortable than failure", "The deadline will not care how tired fear sounds", "Old habits are negotiating for control", "The next hour can either repeat the pattern or break it"],
    directLines: ["We start smaller than your pride wants and larger than your fear allows", "Tell me what you want, then tell me what you are avoiding", "You do not need confidence to take the first step", "I am not here to shame you; I am here to keep you honest"],
    promises: ["we can make a plan that survives a bad day", "I will push the work, not your worth", "the next ten minutes can become evidence", "we will trade overwhelm for one clean action"],
    tagExtras: ["coach", "mentor", "motivation", "training", "accountability"]
  },
  {
    genre: "Historical fiction",
    firstNames: ["Clara", "Edmund", "Beatrice", "Hugo", "Nell", "August", "Josephine", "Thomas", "Eleanor", "Percival", "Ada", "Samuel", "Cora", "Benedict", "Lydia", "Frederick", "Mabel", "Arthur"],
    lastNames: ["Whitlock", "Fairfax", "Bell", "Hawthorne", "Pembrook", "Vale", "Ashby", "March", "Sinclair", "Wren"],
    roles: ["wartime code clerk", "disguised noble courier", "restless apothecary", "newspaper correspondent", "railway detective", "court seamstress with secrets", "ship surgeon", "revolutionary printer"],
    tropes: ["forbidden letters", "class tension", "secret identity", "wartime trust", "society scandal", "political intrigue", "journey by rail", "hidden inheritance"],
    settings: ["A foggy railway platform waits under gaslight", "A wartime office clicks with coded messages past midnight", "A country manor prepares for a dinner no one wants to attend", "A print shop hides forbidden pamphlets beneath wedding notices"],
    pasts: ["sending brave words under someone else's signature", "serving families who never learned their real name", "patching wounds and rumors with equal care", "writing truths that powerful men prefer buried"],
    complications: ["the user carries a letter that could change a trial", "a scandal breaks before the carriage arrives", "a coded telegram names the wrong suspect", "a noble guest recognizes a face that should be dead"],
    meetings: ["the user steps into the wrong compartment with the right secret", "the user asks for medicine and receives a warning", "the user finds them burning a letter too late", "the user arrives at the manor as every clock stops"],
    sensory: ["Coal smoke curls beneath the station roof", "Ink stains the desk beside a cooling cup of tea", "Rain taps against carriage windows in polite little threats", "Gaslight turns every face half-guilty"],
    props: ["a sealed letter", "a brass telegram key", "a lace glove hiding ink stains", "a pocket watch stopped at the wrong hour"],
    gestures: ["lowers their voice without lowering their gaze", "folds the letter along a crease worn by worry", "buttons their coat like armor", "glances toward the door before daring honesty"],
    threats: ["The constable is closer than anyone admits", "The telegram has already been intercepted once", "A family name is about to become a weapon", "The train leaves before the truth is ready"],
    directLines: ["You must decide whether this letter is evidence or mercy", "Speak plainly; the walls here are too well bred to seem curious", "I can get you out, but not without changing your name", "History is made of people who had no time to be certain"],
    promises: ["we can keep one step ahead of scandal and law", "I will tell you what I know before the train whistle", "the truth may ruin a house, but it can save a life", "tonight demands courage dressed as manners"],
    tagExtras: ["period drama", "intrigue", "letters", "society", "wartime"]
  },
  {
    genre: "Mystery/Noir",
    firstNames: ["Marlowe", "June", "Inez", "Calder", "Violet", "Ray", "Simone", "Miles", "Greta", "Theo", "Opal", "Dane", "Lena", "Rex", "Carmen", "Nico", "Pearl", "Wade"],
    lastNames: ["Rain", "Holloway", "Fox", "Vane", "Archer", "Doyle", "Glass", "Vale", "Cross", "Noir"],
    roles: ["private investigator", "jazz club informant", "retired safecracker", "forensic photographer", "newspaper crime columnist", "hotel night manager", "missing persons specialist", "crooked cop trying to quit"],
    tropes: ["cold case", "femme fatale ally", "last witness", "corrupt city", "locked room", "missing heir", "double cross", "rainy confession"],
    settings: ["The city forgets nothing, especially in rain", "A hotel lobby glows gold while secrets rot upstairs", "The jazz club keeps playing after the police arrive", "A photography darkroom reveals a face no one remembers"],
    pasts: ["solving other people's grief to avoid their own", "keeping names out of police reports for the right price", "chasing a case that ended their clean life", "knowing every alley where the city hides its shame"],
    complications: ["the user brings a photograph that should be blank", "the murdered man calls the office at midnight", "a witness vanishes from a room with one locked door", "the same blue matchbook appears at every crime scene"],
    meetings: ["the user enters with rain on their coat and trouble in their hands", "the user follows a stranger to their office by mistake", "the user recognizes a corpse no one has identified", "the user hears their name in a confession meant for someone else"],
    sensory: ["Rain writes crooked lines down the window", "Cigarette smoke curls under a lazy ceiling fan", "The saxophone downstairs sounds like an apology", "Developer lights turn the photograph silver and wrong"],
    props: ["a blue matchbook", "a cracked camera lens", "a hotel key with no room number", "a case file tied with red string"],
    gestures: ["lights a cigarette they never smoke", "slides the photograph across the desk with two fingers", "checks the reflection in the dark window", "smiles like bad news finally learned manners"],
    threats: ["Someone paid well to make this case disappear", "The police report has a page missing and a page added", "The last witness is lying for a reason worth fearing", "The city is trying to bury the user before dawn"],
    directLines: ["People do not come here because things are simple", "That photograph is trouble with a nice frame", "Tell me what you left out before it gets us killed", "I believe you, which is the first mistake tonight"],
    promises: ["we can follow the lie until it gets tired", "I will keep the questions sharp and the exits open", "the city may own the night, but not the ending", "by sunrise, someone powerful will wish you had stayed quiet"],
    tagExtras: ["detective", "noir", "crime", "cold case", "corruption"]
  },
  {
    genre: "Supernatural",
    firstNames: ["Raven", "Milo", "Sasha", "Eden", "Luc", "Ivy", "Misha", "Selah", "Noel", "Arden", "Faye", "Rowe", "Cai", "Mina", "Tobin", "Lark", "Niko", "Zev"],
    lastNames: ["Night", "Wilde", "Vale", "Ash", "Hallow", "Frost", "Moon", "Crow", "Shade", "Fern"],
    roles: ["friendly vampire landlord", "witch with unreliable visions", "ghost who refuses to leave", "werewolf paramedic", "angel on probation", "fae debt collector", "medium radio host", "demon trying to be decent"],
    tropes: ["monster roommate", "secret supernatural town", "found family coven", "unlikely protector", "haunted romance", "magical debt", "urban fantasy", "afterlife mystery"],
    settings: ["The laundromat machines spin even when unplugged", "A hidden street appears only after midnight rain", "The local radio station broadcasts messages from the dead", "A boarding house shelters beings who cannot go home"],
    pasts: ["learning to live gently with a nature others fear", "owing a debt to something older than language", "helping lost souls while hiding their own loneliness", "keeping peace between humans and the creatures beside them"],
    complications: ["the user accidentally inherits a supernatural contract", "a ghost follows the user home and refuses to explain why", "the town's protective spell misidentifies the user as a threat", "a full moon arrives a week early"],
    meetings: ["the user knocks on the wrong door and sees too much", "the user hears their name on a dead radio channel", "the user finds them feeding alley cats at 3 a.m. like nothing is strange", "the user steps into a circle of salt that was not there yesterday"],
    sensory: ["Streetlights flicker in a rhythm too deliberate to ignore", "The air smells of rain, lavender, and cold iron", "A record plays backward in the apartment upstairs", "Moonlight pools on the floor like spilled milk"],
    props: ["a salt-stained lease", "a silver lighter that will not spark", "a jar of moth-wing dust", "a radio tuned to no station"],
    gestures: ["shows their hands first to seem less frightening", "listens to the empty hallway with practiced patience", "grins with too many secrets and not enough malice", "steps between the user and a shadow that moves wrong"],
    threats: ["The contract has already written the user's name", "Something old is checking every mirror in the building", "The moon is not where it should be", "A polite demon is waiting downstairs with paperwork"],
    directLines: ["This is going to sound impossible, so please sit down", "Do not sign anything that smells like roses", "You are not cursed yet, but someone is trying", "If the shadow bows, bow back and do not speak"],
    promises: ["we can untangle the magic before it learns your habits", "I will explain the rules while breaking the safest one", "you may keep your ordinary life if we move quickly", "tonight can become a disaster or a secret friendship"],
    tagExtras: ["urban fantasy", "monster", "witch", "ghost", "coven"]
  }
];

const greetingPatterns = [
  ({ name, sensory, prop, gesture, threat, directLine, promise }) =>
    `${sensory}. ${name} stands beside ${prop}, and the room seems to hold its breath around them. ${name} ${gesture}, measuring the user with an expression that is neither welcome nor warning. "${directLine}," they say, voice low enough to feel meant only for this moment. ${threat}. If the user stays, ${promise}.`,
  ({ name, sensory, prop, gesture, threat, directLine, promise }) =>
    `${sensory}, turning every edge of the scene sharper than it should be. ${name} lifts ${prop} as if it has just confessed something important. ${name} ${gesture}, then makes space for the user without pretending the danger is small. "${directLine}," they murmur. ${threat}, and ${promise}.`,
  ({ name, sensory, prop, gesture, threat, directLine, promise }) =>
    `${sensory}. For a few seconds, ${name} says nothing, only watches the user arrive with trouble following close behind. Their hand rests near ${prop}, careful rather than theatrical. "${directLine}," they say, and the silence after it feels deliberate. ${threat}; even so, ${promise}.`,
  ({ name, sensory, prop, gesture, threat, directLine, promise }) =>
    `${sensory} as the door shuts with a sound too final for comfort. ${name} ${gesture}, then glances at ${prop} like it has become evidence. The user is close enough now to see the fatigue hidden under composure. "${directLine}," they say. ${threat}, but ${promise}.`,
  ({ name, sensory, prop, gesture, threat, directLine, promise }) =>
    `${sensory}. ${name} does not startle when the user appears; they look as if they have been expecting a different version of this moment. ${prop} catches the light between them. ${name} ${gesture}, offering neither easy trust nor easy dismissal. "${directLine}," they say, because ${threat}. Stay long enough, and ${promise}.`,
  ({ name, sensory, prop, gesture, threat, directLine, promise }) =>
    `${sensory}, softening nothing. ${name} places ${prop} between them and the rest of the world like a small border. ${name} ${gesture}, and for an instant their guarded expression cracks into something more human. "${directLine}," they say. ${threat}; still, ${promise}.`,
  ({ name, sensory, prop, gesture, threat, directLine, promise }) =>
    `${sensory}. The first thing the user notices is ${prop}, the second is how carefully ${name} avoids looking afraid. ${name} ${gesture}, turning an ordinary pause into an invitation. "${directLine}," they say, not unkindly. ${threat}, and there is only one honest comfort: ${promise}.`,
  ({ name, sensory, prop, gesture, threat, directLine, promise }) =>
    `${sensory}, and the world outside feels suddenly far away. ${name} waits beside ${prop}, patient in the way storms are patient. ${name} ${gesture}, studying whether the user will run, lie, or ask the right question. "${directLine}," they say. ${threat}; if courage holds, ${promise}.`
];

const shortDescriptionOpeners = [
  ({ name, role, desire }) => `${name} is ${article(role)} ${role} who hides ${desire} behind a carefully controlled smile.`,
  ({ name, role, desire }) => `${name} is ${article(role)} ${role} whose quiet confidence masks ${desire}.`,
  ({ name, role, desire }) => `${name} is ${article(role)} ${role} drawn toward people brave enough to notice ${desire}.`,
  ({ name, role, desire }) => `${name} is ${article(role)} ${role} with a guarded heart, a dangerous talent, and ${desire}.`,
  ({ name, role, desire }) => `${name} is ${article(role)} ${role} who turns every conversation into a chance to reveal ${desire}.`
];

const desires = [
  "a longing to be trusted",
  "an old wound they refuse to name",
  "a secret that could change the user's path",
  "a need for one honest ally",
  "a promise they are afraid to break",
  "a fragile hope they keep disguised as practicality",
  "a question they cannot answer alone",
  "a loyalty that may cost them everything"
];

const avatarDetails = [
  "expressive face, premium cinematic lighting, detailed clothing, atmospheric background",
  "half-lit portrait, elegant silhouette, emotional eyes, subtle genre-specific props",
  "character card composition with strong focal point, soft glow, polished dark UI palette",
  "realistic stylized portrait, textured costume, calm pose, immersive environmental hints",
  "close-up avatar with distinctive hairstyle, meaningful accessory, and refined dramatic color"
];

function generate() {
  const characters = [];
  const usedNames = new Set();

  for (const config of genreConfigs) {
    for (let index = 0; index < COUNT_PER_GENRE; index += 1) {
      const serial = index + 1;
      const role = pick(config.roles, index, 3);
      const trope = pick(config.tropes, index, 5);
      const tone = pick(shared.tones, index + config.genre.length, 7);
      const speechStyle = pick(shared.speechStyles, index, 5);
      const initiative = pick(shared.initiative, index, 11);
      const first = config.firstNames[index % config.firstNames.length];
      const last = config.lastNames[Math.floor(index / config.firstNames.length) % config.lastNames.length];
      let name = `${first} ${last}`;
      if (usedNames.has(name)) {
        name = `${first} ${last} ${titleCase(pick(trope.split(" "), 0))}`;
      }
      usedNames.add(name);

      const setting = pick(config.settings, index, 2);
      const past = pick(config.pasts, index, 3);
      const complication = pick(config.complications, index, 5);
      const meeting = pick(config.meetings, index, 7);
      const sensory = pick(config.sensory, index, 3);
      const prop = pick(config.props, index, 5);
      const gesture = pick(config.gestures, index, 7);
      const threat = pick(config.threats, index, 11);
      const directLine = pick(config.directLines, index, 13);
      const promise = pick(config.promises, index, 17);
      const desire = pick(desires, index, 19);
      const greeting = pick(greetingPatterns, index, 1)({
        name,
        sensory,
        prop,
        gesture,
        threat,
        directLine,
        promise
      });

      characters.push({
        id: `velora-${slug(config.genre)}-${String(serial).padStart(3, "0")}`,
        name,
        shortDescription: pick(shortDescriptionOpeners, index, 1)({ name, role, desire }),
        personaPrompt: [
          `You are ${name}, ${article(role)} ${role} built for ${config.genre} roleplay with the core trope of ${trope}.`,
          `Speak in ${speechStyle}, carrying ${article(tone)} ${tone} emotional tone while grounding each reply in sensory detail, subtext, and clear character motivation.`,
          `Stay collaborative: protect the user's agency, ask scene-forward questions, respect stated boundaries, and never force romance, violence, trauma, or irreversible outcomes.`,
          `Take ${initiative} initiative by introducing complications, memories, and meaningful choices when the scene slows, while following the user's direction and keeping continuity tight.`
        ].join(" "),
        scenarioBackstory: [
          `${setting}, and ${name} has spent years ${past}.`,
          `Now ${complication}, turning private survival into a story that can no longer stay hidden.`,
          `The story turns when ${meeting}, giving ${name} a reason to reveal what they normally keep controlled.`
        ].join(" "),
        greetingMessage: greeting,
        tags: uniqueTags([config.genre, trope, role, tone, pick(config.tagExtras, index, 3)]),
        emotionalTone: tone,
        conversationHooks: [
          `${name} needs the user to decide whether to trust them before the situation closes in.`,
          `A secret tied to ${trope} is about to surface, and the next answer can shift the entire relationship.`
        ].join(" "),
        avatarDescription: `${pick(shared.avatarStyles, index, 2)}; ${pick(avatarDetails, index, 3)}; visual theme: ${config.genre}, ${trope}.`
      });
    }
  }

  validateCharacters(characters);
  return characters;
}

function pick(values, index, step = 1) {
  return values[(index * step) % values.length];
}

function article(value) {
  return /^[aeiou]/i.test(value) ? "an" : "a";
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function titleCase(value) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function uniqueTags(tags) {
  return [...new Set(tags.map((tag) => tag.toLowerCase().replace(/[^a-z0-9/ -]+/g, "").trim()).filter(Boolean))];
}

function sentenceCount(value) {
  return (value.match(/[.!?](?=\s|$)/g) ?? []).length;
}

function validateCharacters(characters) {
  if (characters.length < 1000) {
    throw new Error(`Expected at least 1000 characters, got ${characters.length}.`);
  }

  const ids = new Set();
  const names = new Set();
  for (const character of characters) {
    for (const field of [
      "id",
      "name",
      "shortDescription",
      "personaPrompt",
      "scenarioBackstory",
      "greetingMessage",
      "tags",
      "emotionalTone",
      "conversationHooks",
      "avatarDescription"
    ]) {
      if (!character[field] || (Array.isArray(character[field]) && character[field].length === 0)) {
        throw new Error(`Missing required field ${field} on ${character.id}.`);
      }
    }
    if (ids.has(character.id)) {
      throw new Error(`Duplicate id: ${character.id}.`);
    }
    if (names.has(character.name)) {
      throw new Error(`Duplicate name: ${character.name}.`);
    }
    ids.add(character.id);
    names.add(character.name);

    if (sentenceCount(character.personaPrompt) < 3) {
      throw new Error(`Persona prompt too short: ${character.id}.`);
    }
    if (sentenceCount(character.scenarioBackstory) < 2) {
      throw new Error(`Scenario too short: ${character.id}.`);
    }
    if (sentenceCount(character.greetingMessage) < 4) {
      throw new Error(`Greeting too short: ${character.id}.`);
    }
    if (character.tags.length < 2) {
      throw new Error(`Not enough tags: ${character.id}.`);
    }
  }
}

const characters = generate();
await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
await writeFile(OUTPUT_FILE, `${JSON.stringify(characters, null, 2)}\n`, "utf8");

console.log(`Generated ${characters.length} characters.`);
console.log(`Wrote ${OUTPUT_FILE}.`);
