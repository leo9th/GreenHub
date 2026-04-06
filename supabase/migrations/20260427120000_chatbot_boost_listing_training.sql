-- Intent: paid listing boost / advertise (seller) vs shopper checkout — improves smart-match for “boost”, “advertise”, etc.

insert into public.training_data (id, intent, patterns, responses, language, approved)
values
  (
    'b1000001-0000-4000-8000-000000000019'::uuid,
    'help_boost_listing',
    array[
      'boost listing',
      'boost my product',
      'boost my listing',
      'advertise listing',
      'advertise product',
      'promote listing',
      'paid visibility',
      'seller boost',
      'paystack boost',
      'boost tier',
      'visibility boost',
      'sponsored listing',
      'featured listing',
      'how to boost',
      'how do i boost',
      'increase visibility listing'
    ],
    array[
      'Boosting is for sellers: it is a separate paid option to show your listing higher in search and feeds. It is not the same as a customer buying a product. Open Seller → Advertise (or your product’s Boost options), pick a tier, and pay through the secure flow.',
      'If you are selling: use Boost or Advertise on your product to extend visibility for a period. If you are shopping: use Add to cart and checkout—that is buying, not boosting.',
      'Need help with checkout as a buyer? Ask about buying or orders. Need more eyes on your stock? Use Advertise / Boost from the seller dashboard.'
    ],
    'en',
    true
  ),
  (
    'b1000001-0000-4000-8000-00000000001a'::uuid,
    'help_boost_listing',
    array[
      'mu akosile han',
      'imudara ifihan',
      'ipolongo akosile',
      'boost olota',
      'boost lori greenhub',
      'bii ṣe mo ṣe boost',
      'fi akosile han siwaju',
      'sanwo fun ifihan'
    ],
    array[
      'Imudara ifihan fun awọn olota nikan: o jẹ aṣayan ti a san fun lati mu akosile rẹ han siwaju ni awọn abajade. Ko jẹ bii ti onibara ti o n ra ọja. Lọ si Olota → Ipolongo tabi awọn aṣayan Boost, yan ipele, ki o sanwo.',
      'Ti o ba jẹ olota: lo Boost tabi Ipolongo lori ọja rẹ. Ti o ba jẹ onibara: lo Fi si kẹkẹ ati ideri—iyẹn jẹ ra, kii ṣe imudara ifihan.'
    ],
    'yo',
    true
  ),
  (
    'b1000001-0000-4000-8000-00000000001b'::uuid,
    'help_boost_listing',
    array[
      'ime ka ọpụrụiche',
      'mgbasa ozi ngwaahịa',
      'boost onye na-ere',
      'boost na greenhub',
      'otu e si mee ka a hụ ọkachamara',
      'ịkwụ ụgwọ maka ọpụrụiche'
    ],
    array[
      'Ime ka ọpụrụiche bụ maka ndị na-ere: ọ bụ nhọrọ dị iche e kwụọ ụgwọ maka ka a hụ ngwaahịa gị nke ọma. Ọ bụghị otu ịzụ dị ka onye na-azụ ahịa. Gaa na Onye na-ere → Mgbasa ozi ma ọ bụ nhọrọ Boost, họrọ ogo, kwụọ ụgwọ.',
      'Ọ bụrụ na ị na-ere: jiri Boost ma ọ bụ Mgbasa ozi. Ọ bụrụ na ị na-azụ: jiri ụgbọ ala na nkwụọ—ịzụ, ọ bụghị ime ka ọpụrụiche.'
    ],
    'ig',
    true
  ),
  (
    'b1000001-0000-4000-8000-00000000001c'::uuid,
    'help_boost_listing',
    array[
      'ƙarfafa samfurin',
      'talla mai biya',
      'boost mai sayarwa',
      'boost a greenhub',
      'yaya zan ƙarfafa samfurin',
      'biyan kuɗi don ganin samfurin'
    ],
    array[
      'Ƙarfafa shine don masu sayarwa: wannan babi ne daban da biyan kuɗi don sayayya. Kuna biyan kuɗi don samfurin ku ya bayyana sama a bincike. Ba haka yadda mai sayayya ke sayen kayan ba. Je Mai sayarwa → Talla ko Boost, zaɓi matakin ku, biya.',
      'Idan kuna sayarwa: amfani da Boost ko Talla. Idan kuna sayayya: amfani da kanti da biyan kuɗi—wannan sayayya ce, ba ƙarfafa ba.'
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
