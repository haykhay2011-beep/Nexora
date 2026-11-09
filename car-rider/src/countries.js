// 195 destinations: 193 UN member states plus the Holy See and Palestine.
// Each maps to a biome (colours, sky, vegetation) and, for many, a landmark
// that fills the distant horizon.

export const BIOMES = {
  T: { name: 'Temperate', sky: [0x3a8ee6, 0x8cc6f2, 0xcfe7f4], ground: '#6bb84a', shades: ['#64b043', '#73c252', '#5ea83f', '#7cc85a', '#6ab547'], hemi: [0xd9efff, 0x5d7f3e], trees: { round: 0.55, pine: 0.45 }, density: 1, rock: 1, bush: 1, leaf: 0xffffff, rockTint: 0xffffff, ring: { cols: [0xb9a89a, 0xa89a94, 0xc3b3a2, 0x9d9a9c], h: [28, 83] } },
  M: { name: 'Mediterranean', sky: [0x2f8fe0, 0x86c4ef, 0xf1e6cf], ground: '#a9b35c', shades: ['#a0aa55', '#b4bd66', '#979f4d', '#bcc46f', '#aab35c'], hemi: [0xfff3dc, 0x8a8a4a], trees: { round: 0.5, pine: 0.5 }, density: 0.55, rock: 1.6, bush: 1.2, leaf: 0xfff0a0, rockTint: 0xf0e6d0, ring: { cols: [0xcdb89a, 0xc2ad92, 0xd6c3a6, 0xb8a58c], h: [30, 85] } },
  D: { name: 'Desert', sky: [0x3b8fd8, 0xa9cfe9, 0xf5e0b8], ground: '#d8b878', shades: ['#d1b06f', '#e0c284', '#c9a762', '#e6cd92', '#d6b77a'], hemi: [0xfff0d0, 0xb08a50], trees: { cactus: 0.6, acacia: 0.15, none: 0.25 }, density: 0.5, rock: 2.2, bush: 0.4, leaf: 0xf0e8a0, rockTint: 0xe8b88a, ring: { cols: [0xd9a66a, 0xcc9a62, 0xe0b480, 0xc79062], h: [20, 60] } },
  S: { name: 'Savanna', sky: [0x3d90da, 0xa5cde8, 0xf3e4bd], ground: '#c4b45e', shades: ['#bba955', '#cfbf6a', '#b09f4d', '#d6c876', '#c2b25c'], hemi: [0xfff1d2, 0x9a8a48], trees: { acacia: 0.65, round: 0.15, none: 0.2 }, density: 0.6, rock: 1.2, bush: 0.8, leaf: 0xe6e08a, rockTint: 0xe6c8a0, ring: { cols: [0xc9aa7a, 0xbd9e72, 0xd3b688, 0xb39468], h: [25, 70] } },
  J: { name: 'Tropical', sky: [0x2b86d0, 0x7dbde0, 0xcfe8de], ground: '#3d9a3a', shades: ['#379035', '#45a542', '#2f8830', '#4cb04a', '#3c9b3d'], hemi: [0xcfeee0, 0x2f6a2f], trees: { palm: 0.4, round: 0.6 }, density: 1.4, rock: 0.7, bush: 1.4, leaf: 0xbfe8a0, rockTint: 0xb8c0b0, ring: { cols: [0x6f9a7c, 0x5f8c74, 0x7aa688, 0x6a947e], h: [40, 100] } },
  A: { name: 'Alpine', sky: [0x2f84e0, 0x8fc9f4, 0xdcecf8], ground: '#6dbb55', shades: ['#66b24f', '#76c35e', '#5fa84a', '#7fcc66', '#6dbb56'], hemi: [0xe0f0ff, 0x5d8a46], trees: { pine: 0.7, round: 0.3 }, density: 1, rock: 1.3, bush: 0.8, leaf: 0xffffff, rockTint: 0xffffff, ring: { cols: [0x9aa6b4, 0x8c99a8, 0xa6b2bf, 0x8190a0], h: [90, 190], snow: true } },
  B: { name: 'Boreal', sky: [0x5f8fb8, 0xa7c3d6, 0xd8e2e9], ground: '#4f8a4a', shades: ['#4a8446', '#559451', '#437c40', '#5c9e58', '#4f8a4b'], hemi: [0xd8e6f2, 0x45683f], trees: { pine: 0.8, snowpine: 0.2 }, density: 1.5, rock: 1, bush: 0.7, leaf: 0xe8fff0, rockTint: 0xd0d8e0, ring: { cols: [0x7d8c98, 0x8a98a4, 0x71808c, 0x94a0aa], h: [30, 80] } },
  U: { name: 'Arctic', sky: [0x7fa3c4, 0xb9d0e0, 0xe8eff5], ground: '#e4ecf0', shades: ['#dce6eb', '#eef4f7', '#d3dfe5', '#f4f8fa', '#e1e9ee'], hemi: [0xeaf3fa, 0xaab8c4], trees: { snowpine: 0.7, none: 0.3 }, density: 0.5, rock: 1.5, bush: 0.2, leaf: 0xffffff, rockTint: 0xc8d0d8, ring: { cols: [0xdfe8ee, 0xcfdbe3, 0xe9f0f5, 0xc4d1db], h: [40, 110], snow: true } },
  P: { name: 'Steppe', sky: [0x3a8ee6, 0x8fc8f0, 0xdbe7de], ground: '#b4b966', shades: ['#abb05e', '#c0c572', '#a1a655', '#c8cd7c', '#b5ba67'], hemi: [0xf0f6e4, 0x8a8f4a], trees: { round: 0.3, none: 0.7 }, density: 0.35, rock: 1.1, bush: 1.4, leaf: 0xe0e8a0, rockTint: 0xe0d8c0, ring: { cols: [0xa8a38a, 0x9a9680, 0xb3ad92, 0x8f8a78], h: [30, 90] } },
  I: { name: 'Island', sky: [0x1f9ae0, 0x74d0ee, 0xd6f2f0], ground: '#a5cf6a', shades: ['#9cc762', '#b1d777', '#93bd59', '#bbdf80', '#a4cc69'], hemi: [0xe0fbff, 0x6a9a50], trees: { palm: 0.85, round: 0.15 }, density: 1, rock: 0.8, bush: 1, leaf: 0xd0ffa8, rockTint: 0xf0e8d0, ring: { cols: [0x78b0c0, 0x6aa6b8, 0x86bccb, 0x5f9db0], h: [14, 40] } },
};

// code | name | continent | biome | landmark
const RAW = `
DZ|Algeria|Africa|D|
AO|Angola|Africa|S|
BJ|Benin|Africa|J|
BW|Botswana|Africa|S|
BF|Burkina Faso|Africa|S|
BI|Burundi|Africa|S|
CV|Cabo Verde|Africa|I|volcano
CM|Cameroon|Africa|J|
CF|Central African Republic|Africa|J|
TD|Chad|Africa|D|
KM|Comoros|Africa|I|volcano
CG|Congo|Africa|J|
CD|DR Congo|Africa|J|
CI|Côte d'Ivoire|Africa|J|
DJ|Djibouti|Africa|D|
EG|Egypt|Africa|D|pyramids
GQ|Equatorial Guinea|Africa|J|
ER|Eritrea|Africa|D|
SZ|Eswatini|Africa|S|
ET|Ethiopia|Africa|S|
GA|Gabon|Africa|J|
GM|Gambia|Africa|S|
GH|Ghana|Africa|J|
GN|Guinea|Africa|J|
GW|Guinea-Bissau|Africa|J|
KE|Kenya|Africa|S|volcano
LS|Lesotho|Africa|A|
LR|Liberia|Africa|J|
LY|Libya|Africa|D|
MG|Madagascar|Africa|J|
MW|Malawi|Africa|S|
ML|Mali|Africa|D|
MR|Mauritania|Africa|D|
MU|Mauritius|Africa|I|
MA|Morocco|Africa|D|
MZ|Mozambique|Africa|S|
NA|Namibia|Africa|D|
NE|Niger|Africa|D|
NG|Nigeria|Africa|S|
RW|Rwanda|Africa|J|
ST|São Tomé and Príncipe|Africa|I|
SN|Senegal|Africa|S|
SC|Seychelles|Africa|I|
SL|Sierra Leone|Africa|J|
SO|Somalia|Africa|D|
ZA|South Africa|Africa|S|mesa
SS|South Sudan|Africa|S|
SD|Sudan|Africa|D|pyramids
TZ|Tanzania|Africa|S|volcano
TG|Togo|Africa|J|
TN|Tunisia|Africa|M|
UG|Uganda|Africa|J|
ZM|Zambia|Africa|S|
ZW|Zimbabwe|Africa|S|
AF|Afghanistan|Asia|P|alps
AM|Armenia|Asia|P|ararat
AZ|Azerbaijan|Asia|P|alps
BH|Bahrain|Asia|D|skyline
BD|Bangladesh|Asia|J|
BT|Bhutan|Asia|A|alps
BN|Brunei|Asia|J|
KH|Cambodia|Asia|J|
CN|China|Asia|T|skyline
CY|Cyprus|Asia|M|
GE|Georgia|Asia|A|alps
IN|India|Asia|S|
ID|Indonesia|Asia|J|volcano
IR|Iran|Asia|D|volcano
IQ|Iraq|Asia|D|
IL|Israel|Asia|M|
JP|Japan|Asia|T|volcano
JO|Jordan|Asia|D|mesa
KZ|Kazakhstan|Asia|P|
KW|Kuwait|Asia|D|skyline
KG|Kyrgyzstan|Asia|A|alps
LA|Laos|Asia|J|
LB|Lebanon|Asia|M|
MY|Malaysia|Asia|J|skyline
MV|Maldives|Asia|I|
MN|Mongolia|Asia|P|
MM|Myanmar|Asia|J|
NP|Nepal|Asia|A|alps
KP|North Korea|Asia|T|
OM|Oman|Asia|D|
PK|Pakistan|Asia|D|alps
PH|Philippines|Asia|J|volcano
QA|Qatar|Asia|D|skyline
SA|Saudi Arabia|Asia|D|
SG|Singapore|Asia|J|skyline
KR|South Korea|Asia|T|skyline
LK|Sri Lanka|Asia|J|
SY|Syria|Asia|D|
TJ|Tajikistan|Asia|A|alps
TH|Thailand|Asia|J|
TL|Timor-Leste|Asia|J|
TR|Türkiye|Asia|M|volcano
TM|Turkmenistan|Asia|D|
AE|United Arab Emirates|Asia|D|skyline
UZ|Uzbekistan|Asia|P|
VN|Vietnam|Asia|J|
YE|Yemen|Asia|D|
PS|Palestine|Asia|M|
AL|Albania|Europe|M|
AD|Andorra|Europe|A|alps
AT|Austria|Europe|A|alps
BY|Belarus|Europe|T|
BE|Belgium|Europe|T|
BA|Bosnia and Herzegovina|Europe|T|
BG|Bulgaria|Europe|T|
HR|Croatia|Europe|M|
CZ|Czechia|Europe|T|
DK|Denmark|Europe|T|
EE|Estonia|Europe|B|
FI|Finland|Europe|B|
FR|France|Europe|T|alps
DE|Germany|Europe|T|
GR|Greece|Europe|M|
HU|Hungary|Europe|P|
IS|Iceland|Europe|U|volcano
IE|Ireland|Europe|T|
IT|Italy|Europe|M|volcano
LV|Latvia|Europe|B|
LI|Liechtenstein|Europe|A|alps
LT|Lithuania|Europe|B|
LU|Luxembourg|Europe|T|
MT|Malta|Europe|M|
MD|Moldova|Europe|P|
MC|Monaco|Europe|M|skyline
ME|Montenegro|Europe|A|alps
NL|Netherlands|Europe|T|
MK|North Macedonia|Europe|T|
NO|Norway|Europe|B|alps
PL|Poland|Europe|T|
PT|Portugal|Europe|M|
RO|Romania|Europe|T|
RU|Russia|Europe|B|
SM|San Marino|Europe|M|
RS|Serbia|Europe|T|
SK|Slovakia|Europe|T|
SI|Slovenia|Europe|A|alps
ES|Spain|Europe|M|
SE|Sweden|Europe|B|
CH|Switzerland|Europe|A|alps
UA|Ukraine|Europe|P|
GB|United Kingdom|Europe|T|
VA|Holy See|Europe|M|
AG|Antigua and Barbuda|North America|I|
BS|Bahamas|North America|I|
BB|Barbados|North America|I|
BZ|Belize|North America|J|
CA|Canada|North America|B|alps
CR|Costa Rica|North America|J|volcano
CU|Cuba|North America|I|
DM|Dominica|North America|I|
DO|Dominican Republic|North America|I|
SV|El Salvador|North America|J|volcano
GD|Grenada|North America|I|
GT|Guatemala|North America|J|volcano
HT|Haiti|North America|I|
HN|Honduras|North America|J|
JM|Jamaica|North America|I|
MX|Mexico|North America|D|volcano
NI|Nicaragua|North America|J|volcano
PA|Panama|North America|J|skyline
KN|Saint Kitts and Nevis|North America|I|
LC|Saint Lucia|North America|I|
VC|Saint Vincent and the Grenadines|North America|I|
TT|Trinidad and Tobago|North America|I|
US|United States|North America|D|mesa
AR|Argentina|South America|P|alps
BO|Bolivia|South America|A|alps
BR|Brazil|South America|J|
CL|Chile|South America|D|volcano
CO|Colombia|South America|J|
EC|Ecuador|South America|J|volcano
GY|Guyana|South America|J|
PY|Paraguay|South America|S|
PE|Peru|South America|A|alps
SR|Suriname|South America|J|
UY|Uruguay|South America|P|
VE|Venezuela|South America|J|mesa
AU|Australia|Oceania|D|uluru
FJ|Fiji|Oceania|I|
KI|Kiribati|Oceania|I|
MH|Marshall Islands|Oceania|I|
FM|Micronesia|Oceania|I|
NR|Nauru|Oceania|I|
NZ|New Zealand|Oceania|T|volcano
PW|Palau|Oceania|I|
PG|Papua New Guinea|Oceania|J|volcano
WS|Samoa|Oceania|I|
SB|Solomon Islands|Oceania|I|
TO|Tonga|Oceania|I|
TV|Tuvalu|Oceania|I|
VU|Vanuatu|Oceania|I|volcano
`;

export const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];

export const COUNTRIES = RAW.trim()
  .split('\n')
  .map((line) => {
    const [code, name, continent, biome, landmark] = line.split('|');
    return { code, name, continent, biome, landmark: landmark || null };
  });

export function flagOf(code) {
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function getCountry(code) {
  return COUNTRIES.find((c) => c.code === code) || COUNTRIES.find((c) => c.code === 'AM');
}
