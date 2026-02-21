// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const SEARCH_URL = process.env.ACESTREAM_SEARCH_URL || 'http://acestream-engine:6878/search';
const STREAM_BASE_URL = process.env.ACESTREAM_STREAM_BASE || 'http://streaming-television.pavel-usanli.online:6878/ace/manifest.m3u8';
const PAGE_SIZE = parseInt(process.env.ACESTREAM_PAGE_SIZE || '10', 10);
const PLAYLIST_FILE = process.env.PLAYLIST_FILE || 'playlist.m3u8';
const CACHE_TTL = parseInt(process.env.PLAYLIST_TTL || '3600', 10); // seconds
const PORT = process.env.PORT || 8000;

const COUNTRY_MAP = {
  'ru': 'Россия',
  'ua': 'Украина',
  'by': 'Беларусь',
  'kz': 'Казахстан',
  'us': 'США',
  'gb': 'Великобритания',
  'de': 'Германия',
  'fr': 'Франция',
  'it': 'Италия',
  'es': 'Испания',
  'tr': 'Турция',
  'pl': 'Польша',
  'nl': 'Нидерланды',
  'be': 'Бельгия',
  'ca': 'Канада',
  'au': 'Австралия',
  'il': 'Израиль',
  'pt': 'Португалия',
  'gr': 'Греция',
  'cz': 'Чехия',
  'hu': 'Венгрия',
  'ro': 'Румыния',
  'bg': 'Болгария',
  'at': 'Австрия',
  'ch': 'Швейцария',
  'se': 'Швеция',
  'no': 'Норвегия',
  'fi': 'Финляндия',
  'dk': 'Дания',
  'ie': 'Ирландия',
  'br': 'Бразилия',
  'ar': 'Аргентина',
  'cl': 'Чили',
  'co': 'Колумбия',
  'mx': 'Мексика',
  'cn': 'Китай',
  'jp': 'Япония',
  'kr': 'Южная Корея',
  'in': 'Индия',
  'sa': 'Саудовская Аравия',
  'ae': 'ОАЭ',
  'eg': 'Египет',
  'za': 'ЮАР',
};

const CATEGORY_MAP = {
  'music': 'Музыка',
  'movies': 'Кино',
};

module.exports = {
  SEARCH_URL,
  STREAM_BASE_URL,
  PAGE_SIZE,
  PLAYLIST_FILE,
  CACHE_TTL,
  PORT,
  COUNTRY_MAP,
  CATEGORY_MAP,
};
