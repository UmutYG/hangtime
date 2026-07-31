import { Lang } from "./i18n";

export type Category =
  | "importance"
  | "slide"
  | "lifeline"
  | "wave"
  | "intention"
  | "pendulum"
  | "reframe";

export type Citation = {
  id: string;
  category: Category;
  chapter: string;
  // `en` is the verbatim text from "Reality Transurfing: steps 1-5" (Vadim Zeland).
  // `tr` is a faithful translation shown when the app language is Turkish.
  en: string;
  tr: string;
};

export const citations: Citation[] = [
  {
    id: "imp-balance",
    category: "importance",
    chapter: "Balance",
    en: "By reducing the level of importance you place on things you immediately re-establish a state of balance.",
    tr: "Şeylere atfettiğin önemi azalttığın anda dengeyi hemen yeniden kurarsın.",
  },
  {
    id: "imp-diminish",
    category: "importance",
    chapter: "Balance",
    en: "To return to a condition of harmony with the rest of the world you have to be able to diminish importance.",
    tr: "Dünyanın geri kalanıyla yeniden uyuma dönmek için önemi azaltabilmen gerekir.",
  },
  {
    id: "imp-doubt",
    category: "importance",
    chapter: "Intention",
    en: "Importance gives rise to doubt which stands as an obstacle on the path to unity.",
    tr: "Önem, birliğe giden yolda engel olan şüpheyi doğurur.",
  },
  {
    id: "slide-habit",
    category: "slide",
    chapter: "Slides",
    en: "Seeing the slide has to become a habit. A slide will only bring results if it is reproduced systematically over a period of time.",
    tr: "Slaytı görmek bir alışkanlık hâline gelmeli. Bir slayt ancak belirli bir süre boyunca sistemli biçimde tekrar edilirse sonuç verir.",
  },
  {
    id: "slide-background",
    category: "slide",
    chapter: "Slides",
    en: "Whatever you are doing conjure up the slide in your mind's eye as often as you can. The picture should always be there in the background.",
    tr: "Ne yapıyor olursan ol, slaytı zihninde olabildiğince sık canlandır. Resim her zaman arka planda durmalı.",
  },
  {
    id: "slide-asif",
    category: "slide",
    chapter: "Slides",
    en: "In order to attune yourself to a life line that corresponds to your dream you have to feel as if you already had it.",
    tr: "Rüyana karşılık gelen yaşam çizgisine ayar olmak için, ona zaten sahipmişsin gibi hissetmelisin.",
  },
  {
    id: "slide-commonplace",
    category: "slide",
    chapter: "Slides",
    en: "The world of your dream should be joyful and at the same time commonplace.",
    tr: "Rüyanın dünyası hem sevinçli hem de sıradan, olağan olmalı.",
  },
  {
    id: "slide-letgo",
    category: "slide",
    chapter: "Slides",
    en: "Avoid the trap of thinking you have something to lose; let go of your doubts and anxieties.",
    tr: "Kaybedecek bir şeyin olduğu tuzağına düşme; şüphelerini ve kaygılarını bırak.",
  },
  {
    id: "life-choice",
    category: "lifeline",
    chapter: "The Alternatives Model",
    en: "Your choice is always realized. You always receive what you choose.",
    tr: "Seçimin her zaman gerçekleşir. Seçtiğin şeyi her zaman alırsın.",
  },
  {
    id: "life-shift",
    category: "lifeline",
    chapter: "The Alternatives Model",
    en: "When the parameters of thought energy change, a shift occurs to a different life line.",
    tr: "Düşünce enerjisinin parametreleri değiştiğinde, farklı bir yaşam çizgisine geçiş olur.",
  },
  {
    id: "life-manifest",
    category: "lifeline",
    chapter: "The Alternatives Model",
    en: "All life does is help manifest your personal choice.",
    tr: "Hayatın tek yaptığı, senin kişisel seçimini açığa çıkarmaya yardım etmektir.",
  },
  {
    id: "wave-goodnews",
    category: "wave",
    chapter: "The Wave of Fortune",
    en: "Close yourself off to bad news and remain open to good news.",
    tr: "Kötü habere kapan, iyi habere açık kal.",
  },
  {
    id: "wave-happynow",
    category: "wave",
    chapter: "The Wave of Fortune",
    en: "Be happy for all that you have in this given moment.",
    tr: "Şu anda sahip olduğun her şey için mutlu ol.",
  },
  {
    id: "wave-destiny",
    category: "wave",
    chapter: "The Wave of Fortune",
    en: "In every minute you give to the Transurfing practice, you are consciously moving towards your dream, setting the course of your own destiny.",
    tr: "Transurfing pratiğine verdiğin her dakikada, bilinçli olarak rüyana doğru ilerler, kendi kaderinin rotasını çizersin.",
  },
  {
    id: "goal-onemain",
    category: "slide",
    chapter: "Energy of Intention",
    en: "Settle on one main goal.",
    tr: "Tek bir ana hedefe karar ver.",
  },
  {
    id: "goal-spread",
    category: "slide",
    chapter: "Visualisation",
    en: "If you set several goals at the same time that are not connected your thought energy will be spread too thin and dissipate into emptiness.",
    tr: "Birbiriyle bağlantısız birden çok hedefi aynı anda koyarsan, düşünce enerjin fazla incelir, dağılır ve boşlukta kaybolur.",
  },
  {
    id: "slide-noforce",
    category: "slide",
    chapter: "Visualisation",
    en: "Do not force yourself to picture the target slide.",
    tr: "Hedef slaytını canlandırmak için kendini zorlama.",
  },
  {
    id: "slide-companion",
    category: "slide",
    chapter: "Slides",
    en: "When you have the habit of returning your thoughts again and again to the goal, the slide becomes a constant companion and its image will always be in the background.",
    tr: "Düşüncelerini tekrar tekrar hedefe döndürme alışkanlığı edindiğinde, slayt sürekli bir yoldaşa dönüşür ve görüntüsü her zaman arka planda durur.",
  },
  {
    id: "pend-refuse",
    category: "pendulum",
    chapter: "Defeating the Pendulum",
    en: "The first and most important condition for successfully defeating a pendulum is to refuse to get into conflict with it.",
    tr: "Bir sarkacı yenmenin ilk ve en önemli koşulu, onunla çatışmaya girmeyi reddetmektir.",
  },
  {
    id: "pend-empty",
    category: "pendulum",
    chapter: "Stopping a Pendulum",
    en: "If I am empty there is nothing for the pendulum to hook onto.",
    tr: "Boşsam, sarkacın tutunabileceği hiçbir şey yoktur.",
  },
  {
    id: "pend-ignore",
    category: "pendulum",
    chapter: "Stopping a Pendulum",
    en: "When you can ignore the pendulum its energy will pass by you, dissipating into space without causing you any harm.",
    tr: "Sarkacı görmezden gelebildiğinde, enerjisi sana dokunmadan yanından geçer ve boşlukta dağılır.",
  },
  {
    id: "pend-feed",
    category: "pendulum",
    chapter: "Destructive Pendulums",
    en: "A pendulum feeds on the energy of its adherents, which increases the power of its sway.",
    tr: "Bir sarkaç, kendisine bağlananların enerjisiyle beslenir; bu da salınımının gücünü artırır.",
  },
  {
    id: "reframe-inner",
    category: "reframe",
    chapter: "Balance",
    en: "The formula of inner importance goes along the lines of: \"I am an important person\" or \"I do important work\".",
    tr: "İç önemin formülü şuna benzer: “Ben önemli bir insanım” ya da “Yaptığım iş önemli”.",
  },
  {
    id: "reframe-outer",
    category: "reframe",
    chapter: "Balance",
    en: "Outer importance is created when a person attributes huge meaning to an object or event taking place in the external world.",
    tr: "Dış önem, kişinin dış dünyadaki bir nesneye veya olaya çok büyük bir anlam yüklemesiyle oluşur.",
  },
  {
    id: "reframe-others",
    category: "reframe",
    chapter: "Inner Importance",
    en: "\"Do you want people to think you are a coward?\" The person filled with internal importance rushes to prove the opposite to themselves and to everyone else!",
    tr: "“İnsanlar seni korkak mı sanacak?” İçsel önemle dolu kişi, tersini kendine ve herkese kanıtlamak için koşar!",
  },
  {
    id: "reframe-freedom",
    category: "reframe",
    chapter: "Balance",
    en: "Once you have let go of inner and outer importance you obtain the treasure called freedom of choice.",
    tr: "İç ve dış önemi bıraktığında, seçim özgürlüğü denen hazineye kavuşursun.",
  },
  {
    id: "reframe-game",
    category: "reframe",
    chapter: "The Game",
    en: "This habit will fade if you decide to play your own game in which you deliberately substitute negative emotion with positive emotion.",
    tr: "Kendi oyununu oynamaya karar verirsen — olumsuz duyguyu bilerek olumluyla değiştirdiğin bir oyun — bu alışkanlık zamanla söner.",
  },
  {
    id: "reframe-roulette",
    category: "reframe",
    chapter: "The Game",
    en: "Life is like a game of roulette.",
    tr: "Hayat bir rulet oyunu gibidir.",
  },
  {
    id: "reframe-present",
    category: "reframe",
    chapter: "The Present Moment",
    en: "It is better to take pleasure in the present moment and simply dispassionately and impeccably place one foot in front of the other.",
    tr: "Şimdiki andan zevk almak ve sakince, kusursuzca bir ayağını diğerinin önüne koymak daha iyidir.",
  },
  {
    id: "reframe-alternatives",
    category: "reframe",
    chapter: "The Alternatives Space",
    en: "In the alternatives space is written everything that was, is, or ever will be.",
    tr: "Değişkenler uzayında, var olmuş, var olan ve var olacak her şey yazılıdır.",
  },
];

export function citationText(c: Citation, lang: Lang): string {
  return lang === "tr" ? c.tr : c.en;
}

// Stable daily pick so the "principle for today" doesn't change on every render.
export function citationForDate(key: string): Citation {
  const seed = key
    .split("-")
    .join("")
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return citations[seed % citations.length];
}

export function byCategory(cat: Category): Citation[] {
  return citations.filter((c) => c.category === cat);
}

// Citations used by the doubt-buster: life lines + letting go of doubt.
export const doubtCitations: Citation[] = citations.filter(
  (c) => c.category === "lifeline" || c.id === "slide-letgo" || c.id === "imp-doubt"
);
