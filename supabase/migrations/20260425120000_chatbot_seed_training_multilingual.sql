-- Seed approved multilingual training_data for the floating chatbot (buy, sell, delivery, payment, verification, support).
-- Idempotent: fixed UUIDs with ON CONFLICT DO UPDATE.

insert into public.training_data (id, intent, patterns, responses, language, approved)
values
  (
    'b1000001-0000-4000-8000-000000000001'::uuid,
    'help_buy_greenhub',
    array[
      'how to buy on greenhub',
      'how do i buy',
      'buying on greenhub',
      'purchase products',
      'place an order',
      'checkout process',
      'add to cart',
      'shop on greenhub',
      'order items',
      'buy from seller',
      'browse and buy',
      'make a purchase'
    ],
    array[
      'To buy on GreenHub: browse categories or search for a product, open the listing, choose quantity or options, then use Add to cart or Buy now. At checkout, enter your delivery address and pay with a supported method. You can message the seller from the product page if you need more details.',
      'Buying is simple: find what you need, add it to your cart, go to checkout, confirm delivery details, and complete payment. Your order status updates in your account.',
      'Start from the home page or search, pick a product you trust, review price and seller info, then proceed to checkout and pay securely.'
    ],
    'en',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000002'::uuid,
    'help_sell_greenhub',
    array[
      'how to sell on greenhub',
      'how do i sell',
      'become a seller',
      'list products',
      'create listing',
      'seller account',
      'start selling',
      'post products',
      'vendor on greenhub',
      'open a shop'
    ],
    array[
      'To sell on GreenHub: create or upgrade to a seller profile, complete verification if required, then use Sell or Add product from your dashboard. Add clear photos, accurate prices, stock, and delivery areas. Respond quickly to buyer messages to build trust.',
      'Sellers list items with good photos and descriptions, set delivery options, and get paid according to GreenHub’s payment rules. Keep your profile and inventory up to date.',
      'After your seller setup is approved, add products one by one or in bulk where supported, and monitor orders and messages from buyers.'
    ],
    'en',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000003'::uuid,
    'help_delivery',
    array[
      'delivery options',
      'how does delivery work',
      'shipping',
      'when will my order arrive',
      'delivery time',
      'delivery fee',
      'pickup',
      'courier',
      'dispatch',
      'track order'
    ],
    array[
      'Delivery depends on the seller and your location. At checkout you will see available options (for example standard or express) and any delivery fee before you pay. After purchase, check My orders for status updates; tracking appears when the seller or courier provides it.',
      'Sellers set which areas they ship to and estimated timelines. If something is unclear, open the product and message the seller before ordering.',
      'If a delivery issue arises, contact the seller first through GreenHub chat, then use support if you still need help.'
    ],
    'en',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000004'::uuid,
    'help_payment',
    array[
      'payment methods',
      'how to pay',
      'pay for order',
      'card payment',
      'bank transfer',
      'cash on delivery',
      'cod',
      'wallet',
      'refund payment'
    ],
    array[
      'Supported payment methods are shown at checkout (for example card, bank transfer, or mobile money depending on your region). You only pay after you confirm the order summary. Refunds, when applicable, follow GreenHub and the seller stated policy.',
      'Choose your payment option on the checkout page, complete the secure flow, and keep your receipt or confirmation in My orders.',
      'Never send money outside GreenHub’s official checkout unless the product flow explicitly allows it; that protects you and keeps support able to help.'
    ],
    'en',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000005'::uuid,
    'help_verification',
    array[
      'account verification',
      'verify my account',
      'kyc',
      'identity verification',
      'seller verification',
      'verified badge',
      'upload id',
      'confirm identity'
    ],
    array[
      'Verification helps buyers and GreenHub trust sellers and higher-risk actions. In Account or Seller settings, follow the prompts to submit required documents; status updates appear in the app. A verified badge may show once review passes.',
      'Use clear photos of requested IDs and matching profile details. If verification fails, read the message and resubmit corrected documents.',
      'Verification requirements can differ for buyers, sellers, and payouts—check the in‑app checklist for your role.'
    ],
    'en',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000006'::uuid,
    'help_support',
    array[
      'contact support',
      'customer service',
      'help center',
      'report a problem',
      'speak to someone',
      'email support',
      'complaint',
      'dispute'
    ],
    array[
      'For help: use Help or Contact in the app footer or settings, or reply through your existing order or chat thread. Include your order ID and screenshots when reporting a problem so we can resolve it faster.',
      'Many issues are fastest if you message the seller first. If you still need GreenHub support, reach out through the official contact options shown in the app.',
      'Do not share passwords or full card numbers in chat; support will never ask for your password.'
    ],
    'en',
    true
  ),

  -- Yorùbá
  (
    'b1000001-0000-4000-8000-000000000007'::uuid,
    'help_buy_greenhub',
    array[
      'bii ṣe mo ṣe ra lori greenhub',
      'bawo ni mo ṣe le ra',
      'ra lori greenhub',
      'ra awọn ọja',
      'fi si kẹkẹ',
      'sanwo',
      'ṣiṣẹ ra',
      'iranlowo ra'
    ],
    array[
      'Lati ra lori GreenHub: ṣawari tabi ṣe ayẹwo fun ọja, ṣii akosile naa, yan iye, lẹna Fi si kẹkẹ tabi Ra bayi. Ni ideri, fi adirẹsi rẹ sii ki o sanwo pẹlu ọna ti o ṣe atilẹyin. O le fi ifiranṣẹ ran ọja ti o ta.',
      'Ṣawari, fi si kẹkẹ, lọ si ideri, jẹri imudojuiwọn, ki o sanwo ni aabo. Ipo ibẹrẹ rẹ wa ni akọọlẹ rẹ.'
    ],
    'yo',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000008'::uuid,
    'help_sell_greenhub',
    array[
      'bii ṣe mo ṣe ta lori greenhub',
      'oloja greenhub',
      'fi ọja han',
      'ṣiṣẹ ta',
      'iwe oja',
      'ṣiṣẹ olota'
    ],
    array[
      'Lati ta: ṣẹda profaili olota, pari ijẹrisi ti o ba nilo, lẹna Ta tabi Fi ọja kun lati dashboard. Fi aworan ati apejuwe to peye, owo, ati agbegbe isinmi. Dahun awọn ifiranṣẹ ni kiakia.',
      'Awọn olota ṣe akosile pẹlu aworan dara, ṣeto awọn aṣayan isinmi, ki o tẹtẹ si awọn ibẹrẹ.'
    ],
    'yo',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000009'::uuid,
    'help_delivery',
    array[
      'isinmi',
      'bii ṣe isinmi ṣe ṣiṣẹ',
      'gbigbe',
      'akoko isinmi',
      'owo isinmi',
      'lati ra de ọdọ mi'
    ],
    array[
      'Isinmi duro lori olota ati adirẹsi rẹ. Ni ideri iwọ yoo rii awọn aṣayan ati owo isinmi ṣaaju sanwo. Ṣayẹwo Awọn ibẹrẹ mi fun ipo.',
      'Ti o ba ni ibeere, fi ifiranṣẹ ran olota kọja ẹrọ GreenHub ṣaaju ibẹrẹ.'
    ],
    'yo',
    true
  ),
  (
    'b1000001-0000-4000-8000-00000000000a'::uuid,
    'help_payment',
    array[
      'owo sisan',
      'bawo ni mo ṣe le sanwo',
      'kadi',
      'ṣiṣẹsan banki',
      'sanwo fun ibẹrẹ'
    ],
    array[
      'Awọn ọna sisan ni a ṣe han ni ideri (kadi, ṣiṣẹsan banki, tabi owo elo ibi ti o ba wulo). Sanwo nikan lẹhin ti o ba ṣatunṣe ibẹrẹ rẹ.',
      'Maṣe fi owo ran ẹnikan ni ita checkout ti o ni igbẹkẹle.'
    ],
    'yo',
    true
  ),
  (
    'b1000001-0000-4000-8000-00000000000b'::uuid,
    'help_verification',
    array[
      'ijẹrisi akọọlẹ',
      'jẹrisi olota',
      'wọle ni idanimọ',
      'fifiranṣẹ id'
    ],
    array[
      'Ijẹrisi ṣe iranlọwọ fun olugbẹkẹle. Ni Eto akọọlẹ tẹle awọn ilana, fi aworan ti o han gbangba silẹ. Ami ijẹrisi le han ti o ba tẹtẹ.',
      'Lo aworan ti o yatọ ati alaye ti o ba mu.'
    ],
    'yo',
    true
  ),
  (
    'b1000001-0000-4000-8000-00000000000c'::uuid,
    'help_support',
    array[
      'iranlowo',
      'kan si atilẹyin',
      'iroyin isoro',
      'sọrọ pẹlu ẹnikan'
    ],
    array[
      'Fun iranlowo: lo Iranlowo tabi Kan si wa ni app, tabi fi ifiranṣẹ ran nipasẹ ibẹrẹ rẹ. Fi ID ibẹrẹ ati aworan kun.',
      'Ọpọlọpọ isoro ni yara ti o ba fi ifiranṣẹ ran olota akọkọ.'
    ],
    'yo',
    true
  ),

  -- Igbo
  (
    'b1000001-0000-4000-8000-00000000000d'::uuid,
    'help_buy_greenhub',
    array[
      'otu e si azụ na greenhub',
      'kedu ka m ga esi azụ',
      'ịzụ na greenhub',
      'tinye na kaadị',
      'kwụọ ụgwọ',
      'ịzụ ihe'
    ],
    array[
      'Iji zụta na GreenHub: chọọ ma ọ bụ lelee ngwaahịa, mepee ndepụta, họrọ ọtụtụ, tinye na Kaadị ma ọ bụ Zụta ugbu a. Na nkwụsịtụ, tinye adreesị gị ma kwụọ ụgwọ. Ị nwere ike ozi onye na-ere ahịa site na ibe ngwaahịa.',
      'Chọọ, tinye na kaadị, gaa na nkwụsịtụ, kwado nnyefe, kwụọ ụgwọ nke ọma. Ọnọdụ gị dị na akaụntụ gị.'
    ],
    'ig',
    true
  ),
  (
    'b1000001-0000-4000-8000-00000000000e'::uuid,
    'help_sell_greenhub',
    array[
      'otu e si ree na greenhub',
      'onye na-ere ahịa',
      'ndepụta ngwaahịa',
      'malite ire',
      'ụlọ ahịa'
    ],
    array[
      'Iji ree: mepụta profaịlụ onye na-ere, mezue nkwenye ọ bụrụ na achọrọ, tinye ngwaahịa site na Ree. Tinye foto na nkọwa zuru oke, ọnụahịa, na mpaghara nnyefe.',
      'Ndị na-ere na-ahazi nnyefe na nzaghachi ozi ndị na-azụ ozugbo.'
    ],
    'ig',
    true
  ),
  (
    'b1000001-0000-4000-8000-00000000000f'::uuid,
    'help_delivery',
    array[
      'nnyefe',
      'otu nnyefe si arụ ọrụ',
      'ụgbọ mmiri',
      'oge nnyefe',
      'ụgwọ nnyefe'
    ],
    array[
      'Nnyefe dabere na onye na-ere na ebe ị nọ. Na nkwụsịtụ ị ga-ahụ nhọrọ na ụgwọ tupu ịkwụ ụgwọ. Lelee Iwu m maka ọnọdụ.',
      'Ozi onye na-ere ma ị nwere ajụjụ tupu ịzụta.'
    ],
    'ig',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000010'::uuid,
    'help_payment',
    array[
      'ụzọ ịkwụ ụgwọ',
      'kedu ka m ga esi kwụọ ụgwọ',
      'kaadị',
      'ụgwọ ụlọ akụ',
      'kwụọ ụgwọ maka iwu'
    ],
    array[
      'Ụzọ ịkwụ ụgwọ na-egosi na nkwụsịtụ (kaadị, nyefe ụlọ akụ, ego mkpanaka dị ka ọ dabara). Kwụọ ụgwọ mgbe ị kwadoro iwu gị.',
      'Echekwaba na ị na-eji ọrụ GreenHub zuru oke.'
    ],
    'ig',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000011'::uuid,
    'help_verification',
    array[
      'nkwenye akaụntụ',
      'nkwenye onye na-ere',
      'njirimara',
      'tinye id'
    ],
    array[
      'Nkwenye na-enyere ndị na-azụ aka. Na Ntọala akaụntụ soro ntụzi tinye nyocha dị mkpa. Agụọ nwere ike ịpụta mgbe emechara.',
      'Jiri foto doro anya na ozi dabara adaba.'
    ],
    'ig',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000012'::uuid,
    'help_support',
    array[
      'enyemaka',
      'kọntaktị',
      'kọwaa nsogbu',
      'kwuo na onye'
    ],
    array[
      'Maka enyemaka: jiri Enyemaka ma ọ bụ Kọntaktị na ngwa ma ọ bụ ziga ozi site na iwu gị. Tinye ID iwu na ihe onyonyo.',
      'Ọtụtụ nsogbu na-aga ngwa ngwa ma ị ziga ozi onye na-ere mbụ.'
    ],
    'ig',
    true
  ),

  -- Hausa
  (
    'b1000001-0000-4000-8000-000000000013'::uuid,
    'help_buy_greenhub',
    array[
      'yaya a saya a greenhub',
      'yaya zan iya saya',
      'saya a greenhub',
      'sanya a cikin keɗe',
      'biyan kuɗi',
      'sayayya'
    ],
    array[
      'Don saya a GreenHub: bincika ko nemi samfur, buɗe jerin, zaɓi adadin, sannan Sanya a keɗe ko Saya yanzu. A biyan kuɗi, shigar da adireshi kuma biya ta hanyar da ake goyan baya. Kuna iya aika saƙon zuwa mai sayarwa daga shafin samfur.',
      'Nemi, sanya a keɗe, je zuwa biyan kuɗi, tabbatar da isarwa, kuma biya cikin aminci. Matsayin odar ku yana a cikin asusun ku.'
    ],
    'ha',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000014'::uuid,
    'help_sell_greenhub',
    array[
      'yaya a sayar da greenhub',
      'mai sayarwa',
      'jerin samfura',
      'fara sayarwa',
      'kantin sayarwa'
    ],
    array[
      'Don sayarwa: ƙirƙiri bayanin mai sayarwa, kammala tabbatarwa idan ana buƙata, sannan Sayar ko Ƙara samfur daga fuskar mai gida. Saka hotuna da bayani masu inganci, farashi, da yankunan isarwa.',
      'Masu sayarwa suna saita isarwa kuma suna amsa saƙonnan saye da sauri.'
    ],
    'ha',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000015'::uuid,
    'help_delivery',
    array[
      'isarwa',
      'yaya isarwa take aiki',
      'jirgin ruwa',
      'lokacin isarwa',
      'kudin isarwa'
    ],
    array[
      'Isarwa ta dogara da mai sayarwa da wurin ku. A biyan kuɗi za ku ga zaɓuɓɓuka da kudin kafin biya. Duba Odar na don matsayi.',
      'Aika saƙon zuwa mai sayarwa idan kuna da tambaya kafin odar.'
    ],
    'ha',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000016'::uuid,
    'help_payment',
    array[
      'hanyoyin biyan kuɗi',
      'yaya zan biya',
      'katin banki',
      'wucewa banki',
      'biyan odar'
    ],
    array[
      'Hanyoyin biyan kuɗi suna bayyana a biyan kuɗi (katin banki, wucewa, kuɗin waya, da sauransu). Biya bayan tabbatar da odar.',
      'Kada ku aika kuɗi a wajen biyan kuɗi na GreenHub ba tare da tabbaci ba.'
    ],
    'ha',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000017'::uuid,
    'help_verification',
    array[
      'tabbatar da asusu',
      'tabbatar da mai sayarwa',
      'tantancewa',
      'loda id'
    ],
    array[
      'Tabbatarwa tana taimakawa ga masu sayayya. A Saitunan asusu bi umarnin, loda takardu masu inganci. Alamar tabbatarwa zata iya bayyana bayan bita.',
      'Yi amfani da hotuna masu kyau da bayani daidai.'
    ],
    'ha',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000018'::uuid,
    'help_support',
    array[
      'goyan baya',
      'tuntuɓar mu',
      'bayar da rahoton matsala',
      'magana da wani'
    ],
    array[
      'Don taimako: yi amfani da Taimako ko Tuntuɓar mu a cikin manhaja ko aika saƙon ta hanyar odar ku. Haɗa lambar odar da hotuna.',
      'Yawancin matsaloli sun fi sauri idan kun tuntuɓi mai sayarwa da farko.'
    ],
    'ha',
    true
  )
on conflict (id) do update set
  intent = excluded.intent,
  patterns = excluded.patterns,
  responses = excluded.responses,
  language = excluded.language,
  approved = excluded.approved;
