export type TrainingRow = {
  intent: string;
  patterns: string[];
  responses: string[];
  language: string;
};

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Avoid matching short patterns like "hi" inside "shipping". */
function patternMatches(messageNorm: string, patternNorm: string): boolean {
  if (!patternNorm) return false;
  if (patternNorm.length <= 3) {
    return messageNorm.split(/\s+/).some((w) => w === patternNorm);
  }
  return messageNorm.includes(patternNorm);
}

function pick(responses: string[]): string {
  if (responses.length === 0) return "";
  return responses[Math.floor(Math.random() * responses.length)]!;
}

function rowsForLang(lang: string): TrainingRow[] {
  const L = lang === "yo" || lang === "ig" || lang === "ha" ? lang : "en";
  return BUILTIN[L] ?? BUILTIN.en;
}

/** Built-in intents: greeting, goodbye, help, product_inquiry, pricing, shipping */
const BUILTIN: Record<string, TrainingRow[]> = {
  en: [
    {
      intent: "greeting",
      language: "en",
      patterns: ["hello", "hi ", "hi", "hey", "good morning", "good afternoon", "good evening", "howdy"],
      responses: [
        "Hello! I’m the GreenHub assistant. Ask me about products, pricing, shipping, or how to buy and sell.",
        "Hi there — how can I help you on GreenHub today?",
      ],
    },
    {
      intent: "goodbye",
      language: "en",
      patterns: ["bye", "goodbye", "see you", "later", "thank you bye", "exit"],
      responses: ["Goodbye — feel free to come back anytime.", "Take care! Happy shopping on GreenHub."],
    },
    {
      intent: "help",
      language: "en",
      patterns: ["help", "what can you do", "how do you work", "support", "assist"],
      responses: [
        "I can explain buying, selling, delivery, and pricing on GreenHub. Try asking about shipping or listing a product.",
        "Ask me about products, pricing, shipping, or say hello. If I’m wrong, use “Teach bot” so we can improve.",
      ],
    },
    {
      intent: "product_inquiry",
      language: "en",
      patterns: ["product", "listing", "item", "buy this", "find a", "search", "is this available", "what's for sale"],
      responses: [
        "Browse categories from the home page or use search to find listings. Open a product to message the seller or add to cart.",
        "Each listing shows photos, price, and seller info. Tap Chat on the product page to ask the seller questions.",
      ],
    },
    {
      intent: "pricing",
      language: "en",
      patterns: ["price", "pricing", "cost", "how much", "fee", "discount", "payment"],
      responses: [
        "Prices are set by sellers on each listing. You’ll see the total at checkout before you pay.",
        "GreenHub supports card, transfer, USSD, and pay-on-delivery where available — check the checkout page for options.",
      ],
    },
    {
      intent: "shipping",
      language: "en",
      patterns: ["ship", "shipping", "delivery", "deliver", "pickup", "courier", "how long"],
      responses: [
        "Delivery options depend on the seller — many offer local meet-up or courier. Check the product’s Delivery options section.",
        "Agree on delivery or a safe public meeting place with the seller in chat before you pay.",
      ],
    },
  ],
  yo: [
    {
      intent: "greeting",
      language: "yo",
      patterns: ["hello", "hi", "hey", "kú isé", "bọ̀dá", "ńlá"],
      responses: [
        "Pẹ̀lẹ́ o! Mo ń ṣe irànwọ́ GreenHub. Béèrè nípa ọjà, owó, gbigbe, tàbí rírá àti títà.",
        "Kú àárọ̀ / kú ìrọ̀lẹ́! Ṣàlàyé ohun tí o fẹ́ ní GreenHub.",
      ],
    },
    {
      intent: "goodbye",
      language: "yo",
      patterns: ["bye", "goodbye", "ódáàrọ̀", "ó dàbọ̀"],
      responses: ["Ó dàbọ̀ — padà bọ̀ nígbà tí o bá fẹ.", "Kú ọjọ́ ọfẹ́!"],
    },
    {
      intent: "help",
      language: "yo",
      patterns: ["help", "irànlowọ́", "kí ni mo le ṣe"],
      responses: [
        "Mo lè sọ ọ̀rọ̀ nípa rírá, títà, owó, àti gbigbe lórí GreenHub. Lo bọ́tì “Teach bot” tí mo bá yàn jẹ.",
      ],
    },
    {
      intent: "product_inquiry",
      language: "yo",
      patterns: ["ọjà", "product", "item", "wá"],
      responses: [
        "Ṣ àwárí lórí ojú ìwọ̀n, tàbí ṣe àyẹ̀wò ẹ̀ka. Ṣí iṣẹ́jú ọjà láti sọ̀rọ̀ sí olùtjà.",
      ],
    },
    {
      intent: "pricing",
      language: "yo",
      patterns: ["owo", "owó", "price", "e lo", "élo"],
      responses: ["Owó wà lórí ọ̀kọ̀ọ́kan ọlọ́wọ̀ láti olùtjà. Ṣ àyẹ̀wò ní ìdádúró sísan."],
    },
    {
      intent: "shipping",
      language: "yo",
      patterns: ["gbigbe", "shipping", "delivery", "rán"],
      responses: [
        "Àwọn olùtjà ń yan ọ̀nà gbigbe tàbí píípù ní ibi amúgbọ. Ṣ àrí àwọn yìí nínú àlàyé ọjà.",
      ],
    },
  ],
  ig: [
    {
      intent: "greeting",
      language: "ig",
      patterns: ["hello", "hi", "hey", "ndewo", "kedu"],
      responses: [
        "Ndewo! Akaụntụ GreenHub m. Jụọ m maka ngwaahịa, ọnụahịa, mbupụ, ịzụ na ire.",
        "Kedu! Kedu ka m ga-esi nyere gị aka taa?",
      ],
    },
    {
      intent: "goodbye",
      language: "ig",
      patterns: ["bye", "goodbye", "ka ọ dị", "ka chi"],
      responses: ["Ka ọ dị — laghachi ma ị chọrọ.", "Hụ gị n’anya!"],
    },
    {
      intent: "help",
      language: "ig",
      patterns: ["help", "enyemaka", "ọrụ"],
      responses: [
        "A pụrụ m ịkọwara ịzụ, ire, ọnụahịa, na mbupụ na GreenHub. Jiri “Teach bot” ma ọ bụrụ na azịza adịghị mma.",
      ],
    },
    {
      intent: "product_inquiry",
      language: "ig",
      patterns: ["ngwaahịa", "product", "ịchọ"],
      responses: [
        "Chọọ na peeji mbụ ma ọ bụ ngalaba. Mepee ndetu iji kwurịta onye na-ere.",
      ],
    },
    {
      intent: "pricing",
      language: "ig",
      patterns: ["ego", "ọnụahịa", "price", "ego ole"],
      responses: ["Ọnụ ọ bụla dị na ndetu site n’aka onye na-ere. Lelee na ịgbazị ego."],
    },
    {
      intent: "shipping",
      language: "ig",
      patterns: ["mbupụ", "shipping", "delivery", "ozi"],
      responses: [
        "Ụzọ nbudata dịgasị iche dabere na onye na-ere. Lelee ngalaba Delivery na Ndetu.",
      ],
    },
  ],
  ha: [
    {
      intent: "greeting",
      language: "ha",
      patterns: ["hello", "hi", "hey", "sannu", "inǔwa"],
      responses: [
        "Sannu! Ina taimakon GreenHub. Tambayi game da kayayyaki, farashi, jigilar kaya, ko saye da sayarwa.",
      ],
    },
    {
      intent: "goodbye",
      language: "ha",
      patterns: ["bye", "goodbye", "sai an jima", "allah yay"],
      responses: ["Sai an jima — mu dawo duk lokacin.", "Allah ya kiyaye!"],
    },
    {
      intent: "help",
      language: "ha",
      patterns: ["help", "taimako", "me zan iya"],
      responses: [
        "Zan iya bayani akan sayen kayayyaki, farashi, da jigilar kaya. Yi amfani da “Teach bot” idan amsa ta ba daidai ba.",
      ],
    },
    {
      intent: "product_inquiry",
      language: "ha",
      patterns: ["kayayyaki", "product", "nema"],
      responses: ["Bincika a shafin farko ko Products. Buɗe bayanin kayan don tattaunawa da mai sayarwa."],
    },
    {
      intent: "pricing",
      language: "ha",
      patterns: ["farashi", "price", "kudi", "nawa"],
      responses: ["Farashin yana da asali daga mai sayarwa. Duba matsayi kafin biyan kuɗi."],
    },
    {
      intent: "shipping",
      language: "ha",
      patterns: ["jigilar", "shipping", "delivery", "isa"],
      responses: [
        "Hanyar jigilar kaya daban ne bisa mai sayarwa. Duba sashin Delivery a cikin bayani.",
      ],
    },
  ],
};

const UNKNOWN: Record<string, string> = {
  en: "I’m not sure yet. Can you teach me? Tap “Teach bot” on this reply with the right answer, or try rephrasing your question.",
  yo: "Mo ò mọ̀ dájúdájú. Ṣe o lè kọ́ mi? Tẹ bọ́tì “Teach bot” láti fún mi ní àṣeyọrí tọ́.",
  ig: "A dịghị m mọ̀. Ị nwere ike ịkụziri m? Pịnye “Teach bot” ka ịnye azịza ziri ezi.",
  ha: "Ban san shi ba tukuna. Kana iya koy mana? Danna “Teach bot” don bayar da amsa mai kyau.",
};

export function unknownMessage(lang: string): string {
  const L = lang === "yo" || lang === "ig" || lang === "ha" ? lang : "en";
  return UNKNOWN[L] ?? UNKNOWN.en;
}

export function matchTraining(
  message: string,
  language: string,
  dbRows: TrainingRow[],
): { intent: string; response: string } | null {
  const n = norm(message);
  if (!n) return null;

  const langs = language === "yo" || language === "ig" || language === "ha"
    ? [language, "en"]
    : [language, "en"];

  const fromDb = dbRows.filter((r) => langs.includes(r.language));
  const builtin = rowsForLang(language).filter((r) => langs.includes(r.language));

  const ordered = [...fromDb, ...builtin];

  for (const row of ordered) {
    for (const p of row.patterns) {
      const pn = norm(p);
      if (!pn) continue;
      if (patternMatches(n, pn) || (pn.length > 3 && pn.includes(n))) {
        const response = pick(row.responses);
        if (response) return { intent: row.intent, response };
      }
    }
  }
  return null;
}
