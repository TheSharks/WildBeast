var Commands  = [];
var Logger    = require('../internal/logger.js').Logger;
var Giphy     = require('../giphy.js');
var Cleverbot = require('cleverbot.io');
var config    = require('../../config.json');
var request   = require('superagent');
var _         = require('lodash');
var numeral   = require('numeral');
var cleverbot = new Cleverbot(config.api_keys.cleverbot_user, config.api_keys.cleverbot_key);
var cryptos   = {'42':  '42-coin', '611':  'sixeleven', '808':  '808coin', '888':  'octocoin', '1337':  '1337', 'BTC':  'bitcoin', 'ETH':  'ethereum', 'XRP':  'ripple', 'LTC':  'litecoin', 'XEM':  'nem', 'ETC':  'ethereum-classic', 'DASH':  'dash', 'MIOTA':  'iota', 'XMR':  'monero', 'STRAT':  'stratis', 'BTS':  'bitshares', 'EOS':  'eos', 'VERI':  'veritaseum', 'ANS':  'neo', 'NEO':  'neo', 'STEEM':  'steem', 'BCC':  'bitconnect', 'ZEC':  'zcash', 'WAVES':  'waves', 'QTUM':  'qtum', 'USDT':  'tether', 'ICN':  'iconomi', 'BCN':  'bytecoin-bcn', 'SC':  'siacoin', 'SNT':  'status', 'GNT':  'golem-network-tokens', 'GNO':  'gnosis-gno', 'XLM':  'stellar', 'REP':  'augur', 'LSK':  'lisk', 'DOGE':  'dogecoin', 'GBYTE':  'byteball', 'FCT':  'factom', 'MAID':  'maidsafecoin', 'GAME':  'gamecredits', 'ARDR':  'ardor', 'DCR':  'decred', 'NXT':  'nxt', 'DGB':  'digibyte', 'KMD':  'komodo', 'BAT':  'batcoin', 'PIVX':  'pivx', 'DGD':  'digixdao', 'MCAP':  'mcap', 'BDL':  'bitdeal', 'PPT':  'populous', 'OMG':  'omisego', 'PAY':  'tenx', 'BNT':  'bancor', '1ST':  'firstblood', 'MTL':  'metal', 'SNGLS':  'singulardtv', 'MGO':  'mobilego', 'SYS':  'syscoin', 'ANT':  'aragon', 'BTCD':  'bitcoindark', 'ARK':  'ark', 'CVC':  'civic', 'LKK':  'lykke', 'COE':  'coeval', 'UBQ':  'ubiq', 'DCT':  'decent', 'PPC':  'peercoin', 'EMC':  'emercoin', 'XVG':  'verge', 'XAS':  'asch', 'LEO':  'leocoin', 'PART':  'particl', 'NMR':  'numeraire', 'EDG':  'edgeless', 'NXS':  'nexus', 'FUN':  'funfair', 'WINGS':  'wings', 'ROUND':  'round', 'LBC':  'library-credit', 'RDD':  'reddcoin', 'RLC':  'rlc', 'STORJ':  'storj', 'NMC':  'namecoin', 'XCP':  'counterparty', 'BLOCK':  'blocknet', 'MLN':  'melon', 'XAUR':  'xaurum', 'MONA':  'monacoin', 'QRL':  'quantum-resistant-ledger', 'PPY':  'peerplays-ppy', 'HMQ':  'humaniq', 'VSL':  'vslice', 'NLG':  'gulden', 'BAY':  'bitbay', 'VIA':  'viacoin', 'FAIR':  'faircoin', 'SIB':  'sibcoin', 'AMP':  'synereo', 'DICE':  'etheroll', 'CLOAK':  'cloakcoin', 'BLK':  'blackcoin', 'POT':  'potcoin', 'XZC':  'zcoin', 'OMNI':  'omni', 'SKY':  'skycoin', 'VTC':  'vertcoin', 'QAU':  'quantum', 'SOAR':  'soarcoin', 'BURST':  'burst', 'YBC':  'ybcoin', 'MOON':  'mooncoin', 'OBITS':  'obits', 'EDR':  'e-dinar-coin', 'XRL':  'rialto', 'ADT':  'adtoken', 'NAV':  'nav-coin', 'XEL':  'elastic', 'EXP':  'expanse', 'TKN':  'tokencard', 'UNITY':  'supernet-unity', 'IOC':  'iocoin', 'MYST':  'mysterium', 'EAC':  'earthcoin', 'GOLOS':  'golos', 'TRST':  'trust', 'TAAS':  'taas', 'ECOB':  'ecobit', 'GRC':  'gridcoin', 'XDN':  'digitalnote', 'RADS':  'radium', 'FRST':  'firstcoin', 'CRW':  'crown', 'PLBT':  'polybius', 'NXC':  'nexium', 'B@':  'bankcoin', 'NVC':  'novacoin', 'UNY':  'unity-ingot', 'NEOS':  'neoscoin', 'SNM':  'sonm', 'AGRS':  'agoras-tokens', 'DTB':  'databits', 'VOX':  'voxels', 'SLS':  'salus', 'ENRG':  'energycoin', 'IFC':  'infinitecoin', 'CFI':  'cofound-it', 'BASH':  'luckchain', 'SAFEX':  'safe-exchange-coin', 'PTOY':  'patientory', 'ION':  'ion', 'WCT':  'waves-community-token', 'PEPECASH':  'pepe-cash', 'PLU':  'pluton', 'SHIFT':  'shift', 'DAXX':  'daxxcoin', 'WDC':  'worldcoin', 'SAN':  'santiment', 'MUE':  'monetaryunit', 'TIME':  'chronobank', 'GRS':  'groestlcoin', 'NVST':  'nvo', 'GUP':  'guppy', 'CLAM':  'clams', 'QRK':  'quark', 'MUSE':  'bitshares-music', 'BCAP':  'bcap', 'SPR':  'spreadcoin', 'DBIX':  'dubaicoin-dbix', 'ECN':  'e-coin', 'MCO':  'monaco', 'BCY':  'bitcrystals', 'RBY':  'rubycoin', 'MEC':  'megacoin', 'HEAT':  'heat-ledger', 'LMC':  'lomocoin', 'MGC':  'gulfcoin', 'UNO':  'unobtanium', 'NOTE':  'dnotes', 'XPM':  'primecoin', 'FTC':  'feathercoin', 'XBY':  'xtrabytes', 'FLDC':  'foldingcoin', 'BITCNY':  'bitcny', 'VRC':  'vericoin', 'FLO':  'florincoin', 'SWT':  'swarm-city', 'RISE':  'rise', 'XBC':  'bitcoin-plus', 'XCN':  'cryptonite', 'NLC2':  'nolimitcoin', 'NET':  'netcoin', 'DGC':  'digitalcoin', 'VASH':  'vpncoin', 'ETT':  'encryptotel', 'GAM':  'gambit', 'BELA':  'belacoin', 'AEON':  'aeon', 'OK':  'okcash', 'ZEN':  'zencash', 'CHC':  'chaincoin', 'EB3':  'eb3-coin', 'PASC':  'pascal-coin', 'EMC2':  'einsteinium', 'INCNT':  'incent', 'SPHR':  'sphere', 'DMD':  'diamond', 'LUN':  'lunyr', 'ADX':  'adex', 'BITB':  'bitbean', 'COVAL':  'circuits-of-value', 'XVC':  'vcash', 'SLR':  'solarcoin', 'MAX':  'maxcoin', 'ESP':  'espers', 'ZET':  'zetacoin', 'EMV':  'ethereum-movie-venture', 'AUR':  'auroracoin', 'CRB':  'creditbit', 'CADASTRAL':  'bitland', 'BSD':  'bitsend', 'MUSIC':  'musicoin', 'PINK':  'pinkcoin', 'MED':  'mediterraneancoin', 'ZCC':  'zccoin', 'GCR':  'global-currency-reserve', 'BLITZ':  'blitzcash', 'ECC':  'eccoin', 'PZM':  'prizm', 'RIC':  'riecoin', 'SKIN':  'skincoin', 'BOST':  'boostcoin', 'APX':  'apx', 'GLD':  'goldcoin', 'CURE':  'curecoin', 'BQX':  'bitquence', 'WGR':  'wagerr', 'DIME':  'dimecoin', 'SEQ':  'sequence', 'ICOO':  'ico-openledger', 'NAUT':  'nautiluscoin', 'ARC':  'arcade-token', 'XST':  'stealthcoin', 'SRC':  'securecoin', 'SBD':  'steem-dollars', 'ABY':  'applebyte', 'DEX':  'instantdex', 'XRB':  'raiblocks', 'ANC':  'antcoin', 'XMY':  'myriad', 'ATMS':  'atmos', 'BITUSD':  'bitusd', 'ZCL':  'zclassic', 'DAR':  'darcrus', 'DYN':  'dynamic', 'PUT':  'putincoin', 'MINT':  'mintcoin', 'SYNX':  'syndicate', 'XSPEC':  'spectrecoin', 'VSM':  'voise', 'TAG':  'tagcoin', 'SNRG':  'synergy', 'XBB':  'boolberry', 'ICASH':  'icash', 'ZENI':  'zennies', 'BTA':  'bata', 'WBB':  'wild-beast-block', 'ZEIT':  'zeitcoin', 'KORE':  'korecoin', 'PDC':  'project-decorum', 'ZRC':  'zrcoin', 'ADC':  'audiocoin', 'INSN':  'insanecoin-insn', 'JNS':  'janus', 'DOPE':  'dopecoin', 'DOT':  'dotcoin', 'STA':  'starta', 'MNE':  'minereum', 'EXCL':  'exclusivecoin', 'TRIG':  'triggers', 'RLT':  'roulettetoken', 'BRX':  'breakout-stake', 'BTM':  'bitmark', 'QWARK':  'qwark', 'CREA':  'creativecoin', 'VRM':  'veriumreserve', 'TIPS':  'fedoracoin', 'TX':  'transfercoin', 'BRK':  'breakout', 'HUSH':  'hush', 'SWIFT':  'bitswift', 'RNS':  'renos', 'CRAVE':  'crave', 'INPAY':  'inpay', 'LGD':  'legends-room', 'HUC':  'huntercoin', 'FST':  'fastcoin', 'CANN':  'cannabiscoin', 'NTRN':  'neutron', 'POSW':  'posw-coin', 'CCRB':  'cryptocarbon', '2GIVE':  '2give', 'ERC':  'europecoin', 'TIX':  'tickets', 'ADL':  'adelphoi', 'THC':  'hempcoin', 'EQT':  'equitrader', 'ADZ':  'adzcoin', 'PTC':  'pesetacoin', 'EGC':  'evergreencoin', 'TRC':  'terracoin', 'VTR':  'vtorrent', 'NKA':  'incakoin', 'FNC':  'fincoin', 'XWC':  'whitecoin', 'BLOCKPAY':  'blockpay', 'VISIO':  'visio', 'GEO':  'geocoin', 'KOBO':  'kobocoin', 'PEPE':  'memetic', 'START':  'startcoin', 'TRUST':  'trustplus', 'ICE':  'idice', 'TKS':  'tokes', 'V':  'version', 'FUCK':  'fucktoken', 'HYP':  'hyperstake', 'NSR':  'nushares', 'XTO':  'tao', 'HKG':  'hacker-gold', 'MER':  'mercury', 'XTC':  'tilecoin', 'FUNC':  'funcoin', 'XVP':  'virtacoinplus', 'EFL':  'e-gulden', 'HTC':  'hitcoin', 'SXC':  'sexcoin', 'NETKO':  'netko', 'PKB':  'parkbyte', 'E4ROW':  'ether-for-the-rest-of-the-world', 'SUPER':  'supercoin', 'HTML5':  'htmlcoin', 'OTX':  'octanox', 'FIMK':  'fimkrypto', 'SPRTS':  'sprouts', 'PING':  'cryptoping', 'EL':  'elcoin-el', 'CPC':  'capricoin', 'DRACO':  'dt-token', 'PND':  'pandacoin-pnd', 'RBX':  'ripto-bux', 'UNB':  'unbreakablecoin', 'WGO':  'wavesgo', 'GLC':  'globalcoin', 'XMG':  'magi', 'LDOGE':  'litedoge', 'BTSR':  'btsr', 'BLU':  'bluecoin', 'CDN':  'canada-ecoin', 'CBX':  'cryptogenic-bullion', 'PROC':  'procurrency', 'MRT':  'miners-reward-token', 'MOIN':  'moin', 'HERO':  'sovereign-hero', 'RAIN':  'condensate', 'ALT':  'altcoin-alt', 'LOG':  'woodcoin', 'XHI':  'hicoin', 'BYC':  'bytecent', 'SMLY':  'smileycoin', 'UIS':  'unitus', 'CFT':  'cryptoforecast', 'SMC':  'smartcoin', 'CNT':  'centurion', 'KRB':  'karbowanec', 'PAK':  'pakcoin', 'FJC':  'fujicoin', 'DSH':  'dashcoin', 'INFX':  'influxcoin', 'FOOT':  'footy-cash', 'ZER':  'zero', 'GCN':  'gcoin', 'CV2':  'colossuscoin-v2', 'BTX':  'bitcointx', 'USNBT':  'nubits', 'NOBL':  'noblecoin', 'ITI':  'iticoin', 'BITS':  'bitstar', 'HNC':  'huncoin', 'DNR':  'denarius-dnr', 'UNIFY':  'unify', 'TOKEN':  'swaptoken', 'POST':  'postcoin', 'DCY':  'dinastycoin', 'BTB':  'bitbar', 'YOC':  'yocoin', 'MZC':  'mazacoin', 'EMD':  'emerald', 'PIGGY':  'piggycoin', '8BIT':  '8bit', 'DEM':  'deutsche-emark', 'ZOI':  'zoin', 'DP':  'digitalprice', 'CNC':  'chncoin', 'XP':  'xp', 'PXC':  'phoenixcoin', 'FRN':  'francs', 'SUMO':  'sumokoin', '4CHN':  'chancoin', 'BXT':  'bittokens', 'XVS':  'vsync', 'ENT':  'eternity', 'SCORE':  'scorecoin', 'FLT':  'fluttercoin', 'AGLC':  'agrolifecoin', 'UFO':  'ufo-coin', 'LTB':  'litebar', 'BERN':  'berncash', 'XJO':  'joulecoin', 'RBIES':  'rubies', 'NYAN':  'nyancoin', 'BUCKS':  'swagbucks', 'VUC':  'virta-unique-coin', 'LINX':  'linx', 'TEK':  'tekcoin', 'XCT':  'c-bit', 'NEWB':  'newbium', 'BITBTC':  'bitbtc', 'C2':  'coin2-1', 'UNITS':  'gameunits', 'CJ':  'cryptojacks', 'KURT':  'kurrent', 'PUTIC':  'putin-classic', 'DUO':  'parallelcoin', 'MSCN':  'master-swiscoin', 'CAT':  'catcoin', 'XRA':  'ratecoin', 'ADCN':  'asiadigicoin', 'MI':  'xiaomicoin', 'PIE':  'piecoin', 'KAYI':  'kayi', 'DAS':  'das', 'ASAFE2':  'allsafe', 'GLT':  'globaltoken', 'PXI':  'prime-xi', 'BITSILVER':  'bitsilver', 'SLG':  'sterlingcoin', 'TSE':  'tattoocoin', 'BITGOLD':  'bitgold', 'ATOM':  'atomic-coin', 'CXT':  'coinonat', 'ECO':  'ecocoin', 'TOR':  'torcoin-tor', 'XLR':  'solaris', 'GCC':  'guccionecoin', 'KUSH':  'kushcoin', 'CNNC':  'cannation', 'KLC':  'kilocoin', 'RBT':  'rimbit', 'REE':  'reecoin', 'STV':  'sativacoin', 'BITEUR':  'biteur', 'MOJO':  'mojocoin', 'VRS':  'veros', 'GPU':  'gpu-coin', 'ICOB':  'icobid', 'NRO':  'neuro', 'XPD':  'petrodollar', 'MNC':  'mantracoin', 'XCO':  'x-coin', 'ERY':  'eryllium', 'AMS':  'amsterdamcoin', 'PULSE':  'pulse', 'FRC':  'freicoin', '$$$':  'money', 'KNC':  'kingn-coin', 'HONEY':  'honey', 'UET':  'useless-ethereum-token', 'DIBC':  'dibcoin', 'ARG':  'argentum', 'COAL':  'bitcoal', 'CREVA':  'crevacoin', 'LBTC':  'litebitcoin', 'FLAX':  'flaxscript', 'CONX':  'concoin', 'BRIA':  'briacoin', '1CR':  '1credit', 'SOCC':  'socialcoin-socc', 'FUZZ':  'fuzzballs', 'BENJI':  'benjirolls', 'LVPS':  'levoplus', 'MTLMC3':  'metal-music-coin', 'ARGUS':  'argus', 'WEX':  'wexcoin', 'EBT':  'ebittree-coin', '420G':  'ganjacoin', 'BOAT':  'doubloon', 'ELS':  'elysium', 'XRC':  'rawcoin2', 'RUP':  'rupee', 'JINN':  'jinn', 'BPC':  'bitpark-coin', 'INSANE':  'insanecoin', 'CNO':  'coin', 'XC':  'xcurrency', 'AC':  'asiacoin', 'IXC':  'ixcoin', 'PANGEA':  'pangea-poker', 'CARBON':  'carboncoin', 'BITZ':  'bitz', 'USC':  'ultimate-secure-cash', 'YASH':  'yashcoin', 'CASINO':  'casino', 'NYC':  'newyorkcoin', 'RC':  'russiacoin', 'TALK':  'btctalkcoin', 'I0C':  'i0coin', 'FUND':  'cryptofund', 'ORB':  'orbitcoin', 'CAGE':  'cagecoin', 'SDC':  'shadowcash', 'HODL':  'hodlcoin', 'TES':  'teslacoin', 'GAIA':  'gaia', 'TROLL':  'trollcoin', 'CRYPT':  'cryptcoin', 'METAL':  'metalcoin', 'MBRS':  'embers', 'TRI':  'triangles', 'BRIT':  'britcoin', 'AU':  'aurumcoin', 'FCN':  'fantomcoin', 'GRE':  'greencoin', 'GOOD':  'good-karma', 'FLY':  'flycoin', 'UTC':  'ultracoin', 'FC2':  'fuelcoin', 'DVC':  'devcoin', 'TRUMP':  'trumpcoin', 'BUN':  'bunnycoin', 'SHORTY':  'shorty', 'FUNK':  'the-cypherfunks', 'HBN':  'hobonickels', 'HPC':  'happycoin', 'MNM':  'mineum', 'LTBC':  'ltbcoin', 'AMBER':  'ambercoin', 'RAREPEPEP':  'rare-pepe-party', 'DWC':  'deepwebcash', 'PASL':  'pascal-lite', 'GTC':  'global-tour-coin', 'XGR':  'goldreserve', 'KIC':  'kibicoin', 'Q2C':  'qubitcoin', 'PSB':  'pesobit', 'UNIC':  'unicoin', 'VIDZ':  'purevidz', 'CCN':  'cannacoin', 'ELE':  'elementrem', 'TIT':  'titcoin', 'MAC':  'machinecoin', 'OHM':  'ohm-wallet', 'ARI':  'aricoin', 'XPY':  'paycoin2', 'BSTY':  'globalboost-y', 'J':  'joincoin', 'STS':  'stress', 'BTD':  'bitcloud', 'CAP':  'bottlecaps', 'LANA':  'lanacoin', 'GB':  'goldblocks', 'CHESS':  'chesscoin', 'TRK':  'truckcoin', 'UNIT':  'universal-currency', 'SWING':  'swing', 'BTCS':  'bitcoin-scrypt', 'CORG':  'corgicoin', 'LOT':  'lottocoin', 'TSTR':  'tristar-coin', 'BLC':  'blakecoin', 'VLT':  'veltor', 'MCRN':  'macron', 'BTCR':  'bitcurrency', 'ECA':  'electra', 'MTM':  'mtmgaming', 'MXT':  'martexcoin', 'PRC':  'prcoin', 'ARCO':  'aquariuscoin', 'XRE':  'revolvercoin', 'CUBE':  'digicube', 'SPACE':  'spacecoin', 'MARS':  'marscoin', 'EUC':  'eurocoin', 'TGC':  'tigercoin', 'GUN':  'guncoin', 'BOLI':  'bolivarcoin', 'JIN':  'jin-coin', 'KED':  'darsek', 'QTL':  'quatloo', 'HMP':  'hempcoin-hmp', 'MAR':  'marijuanacoin', 'PR':  'prototanium', 'PHS':  'philosopher-stones', 'IMS':  'independent-money-system', 'CSC':  'casinocoin', 'RED':  'redcoin', 'PIP':  'pipcoin', 'YAC':  'yacoin', 'EVO':  'evotion', 'CPN':  'compucoin', 'CRX':  'chronos', 'QCN':  'quazarcoin', 'VC':  'virtualcoin', 'DLC':  'dollarcoin', 'SPT':  'spots', 'HAL':  'halcyon', 'VAL':  'valorbit', 'WORM':  'healthywormcoin', 'WAY':  'wayguide', 'GP':  'goldpay-coin', 'BUMBA':  'bumbacoin', 'CON':  'paycon', 'BIGUP':  'bigup', 'BTPL':  'bitcoin-planet', 'SPEX':  'sproutsextreme', 'VTA':  'virtacoin', 'EVIL':  'evil-coin', 'UNI':  'universe', 'ZNY':  'bitzeny', 'TTC':  'tittiecoin', 'PHO':  'photon', 'GRT':  'grantcoin', 'VEC2':  'vector', 'CYP':  'cypher', 'CACH':  'cachecoin', 'SOON':  'sooncoin', 'DRM':  'dreamcoin', 'ACOIN':  'acoin', 'WYV':  'wyvern', 'GAP':  'gapcoin', 'BIP':  'bipcoin', 'CHAO':  '23-skidoo', 'ATX':  'artex-coin', 'VLTC':  'vault-coin', 'DIX':  'dix-asset', 'NEVA':  'nevacoin', 'POP':  'popularcoin', 'PX':  'px', 'FRK':  'franko', 'BCF':  'bitcoinfast', 'WMC':  'wmcoin', 'B3':  'b3coin', 'UNIBURST':  'uniburst', 'BLRY':  'billarycoin', 'DRS':  'digital-rupees', 'DBTC':  'debitcoin', 'TAJ':  'tajcoin', 'MAD':  'satoshimadness', 'ALL':  'allion', 'HXX':  'hexx', 'BOB':  'dobbscoin', 'SONG':  'songcoin', 'FIRE':  'firecoin', 'JWL':  'jewels', 'FLVR':  'flavorcoin', 'XCRE':  'creatio', 'BVC':  'beavercoin', 'SFC':  'solarflarecoin', 'RPC':  'ronpaulcoin', 'GBC':  'gbcgoldcoin', 'ISL':  'islacoin', 'MEOW':  'kittehcoin', 'BQC':  'bbqcoin', 'AUM':  'alexium', 'PONZI':  'ponzicoin', 'BNX':  'bnrtxcoin', 'CMT':  'comet', 'LUNA':  'luna-coin', 'ACP':  'anarchistsprime', 'DOLLAR':  'dollar-online', 'MND':  'mindcoin', 'CTO':  'crypto', 'ARB':  'arbit', 'URC':  'unrealcoin', 'SCRT':  'secretcoin', 'MST':  'mustangcoin', 'ZUR':  'zurcoin', 'ZMC':  'zetamicron', 'ANTI':  'antibitcoin', 'XBTS':  'beatcoin', 'URO':  'uro', 'ZYD':  'zayedcoin', 'XPTX':  'platinumbar', 'PLNC':  'plncoin', 'VIP':  'vip-tokens', 'CESC':  'cryptoescudo', 'CASH':  'cashcoin', 'IMX':  'impact', 'RIDE':  'ride-my-car', 'OFF':  'cthulhu-offerings', 'LTCR':  'litecred', 'DES':  'destiny', 'BLZ':  'blazecoin', 'MAY':  'theresa-may-coin', 'LEA':  'leacoin', 'ORLY':  'orlycoin', 'XBTC21':  'bitcoin-21', 'MILO':  'milocoin', 'CWXT':  'cryptoworldx-token', 'SH':  'shilling', 'PRX':  'printerium', 'SLING':  'sling', 'OCEAN':  'burstocean', 'AMMO':  'ammo-rewards', 'GBT':  'gamebet-coin', 'BIOS':  'bios-crypto', 'STEPS':  'steps', 'G3N':  'genstake', 'U':  'ucoin', 'BTQ':  'bitquark', 'GEERT':  'geertcoin', 'XOC':  'xonecoin', 'SLEVIN':  'slevin', 'CAB':  'cabbage', 'HVCO':  'high-voltage', 'WARP':  'warp', 'SCS':  'speedcash', 'HIRO':  'hirocoin', 'BSTAR':  'blackstar', 'ICON':  'iconic', 'IMPS':  'impulsecoin', 'TAGR':  'tagrcoin', 'BSC':  'bowscoin', 'ALTC':  'antilitecoin', 'QBK':  'qibuck-asset', 'OS76':  'osmiumcoin', 'DLISK':  'dappster', 'CCM100':  'ccminer', 'EGO':  'ego', 'DPAY':  'dpay', 'ZNE':  'zonecoin', 'IMPCH':  'impeachcoin', 'JOBS':  'jobscoin', 'VOLT':  'bitvolt', 'REV':  'revenu', 'LIR':  'letitride', 'CRT':  'crtcoin', 'IBANK':  'ibank', 'SDP':  'sydpak', 'VPRC':  'vaperscoin', 'ONX':  'onix', 'JIO':  'jio-token', 'ABN':  'abncoin', 'LEX':  'lex4all', 'PEX':  'posex', 'SANDG':  'save-and-gain', 'MGM':  'magnum', 'ETB':  'ethbits', 'ENV':  'environ', 'CF':  'californium', 'BIOB':  'biobar', 'NODC':  'nodecoin', 'XNG':  'enigma', 'P7C':  'p7coin', 'DRAGON':  'btcdragon', 'PIZZA':  'pizzacoin', 'FDC':  'future-digital-currency', 'SLFI':  'selfiecoin', 'XEN':  'xenixcoin', 'DGCS':  'digital-credits', 'PWR':  'powercoin', 'ZHS':  'zcashshare', 'MUG':  'mikethemug', 'DMB':  'digital-money-bits', 'CALC':  'caliphcoin', 'GXS':  'gxshares', 'ICO':  'ico', 'HLB':  'lepaoquan', 'DMC':  'dynamiccoin', 'FRGC':  'fargocoin', 'ETP':  'metaverse', 'ATCC':  'atc-coin', 'SJCX':  'storjcoin-x', 'GYC':  'gycoin', 'BGC':  'bagcoin', 'AXF':  'axfunds', 'XID':  'international-diamond', 'OCN':  'operacoin', 'BITOK':  'bitok', 'EBST':  'eboostcoin', 'PCS':  'pabyosi-coin-special', 'LINDA':  'linda', 'FAL':  'falcoin', 'RSGP':  'rsgpcoin', 'MALC':  'malcoin', 'DTF':  'digitalfund', 'CLUB':  'clubcoin', 'SHELL':  'shellcoin', 'DHG':  'dhg', 'EDRC':  'edrcoin', 'MG':  'mind-gene', 'GBG':  'golos-gold', 'WA':  'wa-space', 'SKULL':  'pirate-blocks', 'KASHH':  'kashhcoin', 'DEUS':  'deuscoin', 'VOYA':  'voyacoin', 'IOP':  'internet-of-people', 'ZBC':  'zilbercoin', 'LNK':  'link-platform', 'BTU':  'bitcoin-unlimited', 'TERA':  'teracoin', 'BET':  'betacoin', 'OPAL':  'opal', 'APC':  'alpacoin', 'TYCHO':  'tychocoin', 'EMP':  'emoneypower', 'FLASH':  'flash', 'PRIMU':  'primulon', 'RUBIT':  'rublebit', 'GUC':  'goldunioncoin', 'CVCOIN':  'cvcoin', 'ACES':  'aces', 'LEPEN':  'lepen', 'SKR':  'sakuracoin', 'MARX':  'marxcoin', 'PAC':  'paccoin', 'FEDS':  'fedorashare', 'UNRC':  'universalroyalcoin', 'THS':  'techshares', 'BIT':  'first-bitcoin', 'SHND':  'stronghands', 'FAZZ':  'fazzcoin', 'TCOIN':  't-coin', 'IFLT':  'inflationcoin', 'XOT':  'internet-of-things', 'GARY':  'president-johnson', 'PRES':  'president-trump', 'TESLA':  'teslacoilcoin', 'DON':  'donationcoin', 'UR':  'ur', 'AE':  'aeternity', 'DASHS':  'dashs', 'ABC':  'alphabitcoinfund', 'GAY':  'gaycoin', 'LDCN':  'landcoin', 'HILL':  'president-clinton', 'BURN':  'president-sanders', 'NTCC':  'neptune-classic', 'SMART':  'smartcash', 'XQN':  'quotient', 'COUPE':  'coupecoin', 'TURBO':  'turbocoin', 'RBBT':  'rabbitcoin', 'STEX':  'stex', 'AIB':  'advanced-internet-blocks', 'SNC':  'suncontract', 'WOMEN':  'women', 'FONZ':  'fonziecoin', 'XVE':  'the-vegan-initiative', 'SHA':  'shacoin', 'ROYAL':  'royalcoin', 'BTWTY':  'bit20', 'JET':  'jetcoin', 'TRADE2':  'tradecoin-v2', 'YOG':  'yogold', 'SLM':  'slimcoin', 'IRL':  'irishcoin', 'MONEY':  'moneycoin', 'XLC':  'leviarcoin', 'QORA':  'qora', 'ACN':  'avoncoin', 'TELL':  'tellurion', 'BEST':  'bestchain', 'AMIS':  'amis', 'TER':  'terranova', 'AXIOM':  'axiom', '9COIN':  '9coin', 'HCC':  'happy-creator-coin', 'MBL':  'mobilecash', 'BTG':  'bitgem', 'ZSE':  'zsecoin', 'YES':  'yescoin', 'LAZ':  'lazaruscoin', 'BRO':  'bitradio', 'NANOX':  'project-x', 'MIU':  'miyucoin', 'FRWC':  'frankywillcoin', 'EFYT':  'ergo', 'GMB':  'gambleo', 'HALLO':  'halloween-coin', 'WOW':  'wowcoin', 'FXE':  'futurexe', 'SOUL':  'soulcoin', 'GPL':  'gold-pressed-latinum', 'MMXVI':  'mmxvi', 'FFC':  'fireflycoin', 'POKE':  'pokecoin', 'EGG':  'eggcoin', 'CHEAP':  'cheapcoin', 'UNC':  'uncoin', 'PI':  'picoin', 'MOTO':  'motocoin', 'BXC':  'bitcedi', 'CBD':  'cbd-crystals', 'TODAY':  'todaycoin', 'RHFC':  'rhfcoin', 'TYC':  'tyrocoin', 'LTH':  'lathaan', 'AV':  'avatarcoin', 'TIC':  'true-investment-coin', 'ELC':  'elacoin', 'BLAZR':  'blazercoin', 'FUTC':  'futcoin', 'GBRC':  'global-business-revolution', 'LKC':  'linkedcoin', 'TOPAZ':  'topaz', 'BUK':  'cryptobuck', 'RMC':  'remicoin', 'IVZ':  'invisiblecoin', 'CC':  'cybercoin', 'QRZ':  'quartz-qrz', 'SKC':  'skeincoin', 'RYCN':  'royalcoin-2', 'PDG':  'pinkdog', 'QBT':  'cubits', 'PRM':  'prismchain', 'DCRE':  'deltacredits', 'TROPTIONS':  'troptions', 'WSX':  'wearesatoshi', 'SFE':  'safecoin', 'MONETA':  'moneta2', 'OPES':  'opescoin', 'XSTC':  'safe-trade-coin', 'CYC':  'cycling-coin', 'SAK':  'sharkcoin', 'ANI':  'animecoin', 'VTY':  'victoriouscoin', 'RCN':  'rcoin', 'X2':  'x2', 'VGC':  'vegascoin', 'TLE':  'tattoocoin-limited', 'IEC':  'ivugeocoin', 'XDE2':  'xde-ii', 'GMX':  'goldmaxcoin', 'DISK':  'darklisk', 'TEAM':  'teamup', 'XBG':  'btcgold', 'GML':  'gameleaguecoin', 'MRC':  'microcoin', 'XAU':  'xaucoin', 'CLINT':  'clinton', 'BAC':  'bitalphacoin', 'WEC':  'wowecoin', 'STRB':  'superturbostake', 'GOLF':  'golfcoin', 'PCN':  'peepcoin', 'RICHX':  'richcoin', 'PSY':  'psilocybin', 'DBG':  'digital-bullion-gold', 'GAIN':  'ugain', 'QBC':  'quebecoin', 'MAVRO':  'mavro', 'KARMA':  'karmacoin', 'OCOW':  'ocow', 'TRICK':  'trickycoin', 'OP':  'operand', 'NBIT':  'netbit', 'PAYP':  'paypeer', 'CME':  'cashme', 'NBE':  'bitcentavo', 'ASC':  'asiccoin', 'SYNC':  'sync', 'BGR':  'bongger', 'TP1':  'kolschcoin', 'DUB':  'dubstep', 'DFT':  'draftcoin', 'BRAIN':  'braincoin', 'TCR':  'thecreed', 'ELCO':  'elcoin', 'SPORT':  'sportscoin', 'OMC':  'omicron', 'ZENGOLD':  'zengold', 'WARRANT':  'warrant', 'ANTX':  'antimatter', 'SNAKE':  'snakeeyes'};

Commands.gif = {
  name: 'gif',
  help: 'I\'ll search Giphy for a gif matching your tags.',
  aliases: ['giphy'],
  timeout: 10,
  level: 0,
  fn: function (msg, suffix) {
    var tags = suffix.split(' ')
    Giphy.get_gif(tags, function (id) {
      if (typeof id !== 'undefined') {
        msg.reply('http://media.giphy.com/media/' + id + '/giphy.gif [Tags: ' + tags + ']')
      } else {
        msg.reply('Sorry! Invalid tags, try something else. For example something that exists [Tags: ' + tags + ']')
      }
    })
  }
}

Commands.rip = {
  name: 'rip',
  help: 'Posts a ripme.xyz link',
  aliases: ['ripme'],
  level: 0,
  timeout: 10,
  fn: function (msg, suffix, bot) {
    var qs = require('querystring')
    var resolve = []
    var skipped = false
    if (msg.mentions.filter(m => m.id !== bot.User.id).length > 0) {
      for (var m of msg.mentions.filter(m => m.id !== bot.User.id)) {
        if (m.id !== bot.User.id) {
          if (resolve[0] === undefined) {
            resolve[0] = m.username
          } else {
            resolve[0] += ' and ' + m.username
          }
        } else {
          skipped = true
        }
      }
    } else if (suffix) {
      resolve[0] = suffix
    }
    if (skipped === true && msg.mentions.filter(m => m.id !== bot.User.id).length === 1 && suffix) {
      resolve[0] = suffix
    }
    msg.channel.sendMessage('http://ripme.xyz/' + qs.stringify(resolve).substr(2))
  }
}

Commands.fortunecow = {
  name: 'fortunecow',
  help: 'I\'ll get a random fortunecow!',
  timeout: 20,
  level: 0,
  fn: function (msg) {
    request.get('https://fortunecow.dougley.com/random')
      .end((err, result) => {
        if (!err && result.status === 200) {
          msg.reply('```' + result.text + '```')
        } else if (result.status === 429) {
          msg.channel.sendMessage('Too many requests, please try again later.')
        } else {
          Logger.warn(err)
        }
      })
  }
}

Commands.randomcat = {
  name: 'randomcat',
  help: 'I\'ll get a random cat image for you!',
  aliases: ['cat'],
  module: 'fun',
  timeout: 10,
  level: 0,
  fn: function (msg) {
    request.get('http://random.cat/meow')
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.sendMessage(res.body.file)
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.randomdog = {
  name: 'randomdog',
  help: 'I\'ll get a random doggo image for you!',
  aliases: ['doggo'],
  module: 'fun',
  timeout: 10,
  level: 0,
  fn: function (msg) {
    request.get('https://random.dog/woof.json')
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.sendMessage(res.body.url)
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.dogfact = {
  name: 'dogfact',
  help: 'I\'ll give you some interesting dogfacts!',
  aliases: ['dogfacts'],
  timeout: 10,
  level: 0,
  fn: function (msg) {
    request.get('https://dog-api.kinduff.com/api/facts')
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.sendMessage(res.body.facts[0])
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.catfact = {
  name: 'catfact',
  help: 'I\'ll give you some interesting catfacts!',
  aliases: ['catfacts'],
  timeout: 10,
  level: 0,
  fn: function (msg) {
    request.get('https://catfact.ninja/fact')
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.sendMessage(res.body.fact)
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.leetspeak = {
  name: 'leetspeak',
  help: '1\'Ll 3nc0d3 Y0uR Me5s@g3 1Nt0 l337sp3@K!',
  aliases: ['leetspeek', 'leetspeach'],
  level: 0,
  fn: function (msg, suffix) {
    if (suffix.length > 0) {
      var leetspeak = require('leetspeak')
      var thing = leetspeak(suffix)
      msg.reply(thing)
    } else {
      msg.reply('*You need to type something to encode your message into l337sp3@K!*')
    }
  }
}

Commands.stroke = {
  name: 'stroke',
  help: 'I\'ll stroke someones ego!',
  timeout: 5,
  level: 0,
  fn: function (msg, suffix) {
    var name
    if (suffix) {
      name = suffix.split('"')
      if (name.length === 1) {
        name = ['', name]
      }
    } else {
      name = ['Andrei', 'Zbikowski'] // I'm not sorry b1nzy <3
    }
    request.get('http://api.icndb.com/jokes/random')
      .query({escape: 'javascript'})
      .query({firstName: name[0]})
      .query({lastName: name[1]})
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.sendMessage(res.body.value.joke)
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.yomomma = {
  name: 'yomomma',
  help: 'I\'ll get a random yomomma joke for you!',
  timeout: 5,
  level: 0,
  fn: function (msg) {
    request.get('http://api.yomomma.info/')
      .end((err, res) => {
        if (!err && res.status === 200) {
          try {
            JSON.parse(res.text)
          } catch (e) {
            msg.channel.sendMessage('The API returned an unconventional response.')
            return
          }
          var joke = JSON.parse(res.text)
          msg.channel.sendMessage(joke.joke)
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.advice = {
  name: 'advice',
  help: 'I\'ll give you some fantastic advice!',
  noDM: true, // Ratelimits Ratelimits Ratelimits Ratelimits
  timeout: 5,
  level: 0,
  fn: function (msg) {
    request.get('http://api.adviceslip.com/advice')
      .end((err, res) => {
        if (!err && res.status === 200) {
          try {
            JSON.parse(res.text)
          } catch (e) {
            msg.channel.sendMessage('The API returned an unconventional response.')
            return
          }
          var advice = JSON.parse(res.text)
          msg.channel.sendMessage(advice.slip.advice)
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.yesno = {
  name: 'yesno',
  help: 'Returns a gif displaying yes or no',
  timeout: 5,
  level: 0,
  fn: function (msg, suffix) {
    request.get('http://yesno.wtf/api/')
      .query({force: suffix})
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.reply(res.body.image)
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.urbandictionary = {
  name: 'urbandictionary',
  help: 'I\'ll fetch what idiots on the internet think something means',
  aliases: ['ud', 'urban'],
  timeout: 10,
  level: 0,
  fn: function (msg, suffix) {
    if (!suffix) {
      msg.reply('Yes, let\'s just look up absolutely nothing.')
    } else {
      request.get('http://api.urbandictionary.com/v0/define')
        .query({term: suffix})
        .end((err, res) => {
          if (!err && res.status === 200) {
            var uD = res.body
            if (uD.result_type !== 'no_results') {
              msg.channel.sendMessage('', false, {
                color: 0x6832e3,
                author: {name: 'UrbanDictionary'},
                title: `The internet's definition of ${uD.list[0].word}`,
                url: uD.list[0].permalink,
                timestamp: new Date(),
                fields: [
                  {name: 'Word', value: `\`\`\`${uD.list[0].word}\`\`\``},
                  {name: 'Definition', value: `\`\`\`${uD.list[0].definition}\`\`\``},
                  {name: 'Example', value: `\`\`\`${uD.list[0].example}\`\`\``},
                  {name: 'Thumbs up', value: `\`\`\`${uD.list[0].thumbs_up}\`\`\``, inline: true},
                  {name: 'Thumbs down', value: `\`\`\`${uD.list[0].thumbs_down}\`\`\``, inline: true}
                ]
              })
            } else {
              msg.reply(suffix + ': This word is so screwed up, even Urban Dictionary doesn\'t have it in its database')
            }
          } else {
            Logger.error(`Got an error: ${err}, status code: ${res.status}`)
          }
        })
    }
  }
}

Commands.fact = {
  name: 'fact',
  help: 'I\'ll give you some interesting facts!',
  timeout: 5,
  level: 0,
  fn: function (msg) {
    var xml2js = require('xml2js')
    request.get('http://www.fayd.org/api/fact.xml')
      .end((err, res) => {
        if (err) {
          Logger.error(err)
        }
        if (!err && res.status === 200) {
          xml2js.parseString(res.text, function (err, result) {
            if (err) {
              Logger.error(err)
            }
            try {
              msg.reply(result.facts.fact[0])
            } catch (e) {
              msg.channel.sendMessage('The API returned an unconventional response.')
            }
          })
        }
      })
  }
}

Commands.dice = {
  name: 'dice',
  help: 'I\'ll roll some dice!',
  timeout: 5,
  level: 0,
  fn: function (msg, suffix) {
    var dice
    if (suffix) {
      dice = suffix
    } else {
      dice = 'd6'
    }
    request.get('https://rolz.org/api/?' + dice + '.json')
      .end((err, res) => {
        if (!err && res.status === 200) {
          var roll = res.body
          msg.reply('Your ' + roll.input + ' resulted in ' + roll.result + ' ' + roll.details)
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.fancyinsult = {
  name: 'fancyinsult',
  help: 'I\'ll insult your friends!',
  aliases: ['insult'],
  timeout: 5,
  level: 0,
  fn: function (msg, suffix) {
    request.get('http://quandyfactory.com/insult/json/')
      .end((err, res) => {
        if (!err && res.status === 200) {
          var fancyinsult = res.body
          if (suffix === '') {
            msg.channel.sendMessage(fancyinsult.insult)
          } else {
            msg.channel.sendMessage(suffix + ', ' + fancyinsult.insult)
          }
        } else {
          Logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}

Commands.cleverbot = {
  name: 'cleverbot',
  help: 'Talk to cleverbot!',
  aliases: ['chat', 'cb', 'talk'],
  level: 0,
  fn: function (msg, suffix) {
    cleverbot.create(function (err, session) {
      if (err) Logger.error(err)
      cleverbot.setNick('wildbeast')
      msg.channel.sendTyping()
      cleverbot.ask(suffix, function (e, r) {
        if (e) Logger.error(e)
        msg.channel.sendMessage(r)
      })
    })
  }
}

Commands.e621 = {
  name: 'e621',
  help: 'e621, the definition of *Stop taking the Internet so seriously.*',
  usage: '<tags> multiword tags need to be typed like: wildbeast_is_a_discord_bot',
  level: 0,
  nsfw: true,
  fn: function (msg, suffix) {
    msg.channel.sendTyping()
    request.post(`https://e621.net/post/index.json`)
      .query({limit: '30', tags: suffix})
      .set({'Accept': 'application/json', 'User-Agent': 'Superagent Node.js'})
      // Fetching 30 posts from E621 with the given tags
      .end(function (err, result) {
        if (!err && result.status === 200) {
          if (result.body.length < 1) {
            msg.reply('Sorry, nothing found.') // Correct me if it's wrong.
          } else {
            var count = Math.floor((Math.random() * result.body.length))
            var FurryArray = []
            if (suffix) {
              FurryArray.push(`${msg.author.mention}, you've searched for ` + '`' + suffix + '`')
            } else {
              FurryArray.push(`${msg.author.mention}, you've searched for ` + '`random`')
            } // hehe no privacy if you do the nsfw commands now.
            FurryArray.push(result.body[count].file_url)
            msg.channel.sendMessage(FurryArray.join('\n'))
          }
        } else {
          Logger.error(`Got an error: ${err}, status code: ${result.status}`)
        }
      })
  }
}

Commands.rule34 = {
  name: 'rule34',
  help: 'Rule#34 : If it exists there is porn of it. If not, start uploading.',
  level: 0,
  nsfw: true,
  fn: function (msg, suffix) {
    msg.channel.sendTyping()
    request.post('http://rule34.xxx/index.php') // Fetching 100 rule34 pics
      .query({page: 'dapi', s: 'post', q: 'index', tags: suffix})
      .end((err, result) => {
        if (err || result.status !== 200) {
          Logger.error(`${err}, status code ${result.status}`)
          msg.channel.sendMessage('The API returned an unconventional response.')
        }
        var xml2js = require('xml2js')
        if (result.text.length < 75) {
          msg.reply('sorry, nothing found.') // Correct me if it's wrong.
        } else {
          xml2js.parseString(result.text, (err, reply) => {
            if (err) {
              msg.channel.sendMessage('The API returned an unconventional response.')
            } else {
              var count = Math.floor((Math.random() * reply.posts.post.length))
              var FurryArray = []
              if (!suffix) {
                FurryArray.push(msg.author.mention + ', you\'ve searched for `random`')
              } else {
                FurryArray.push(msg.author.mention + ', you\'ve searched for `' + suffix + '`')
              }
              FurryArray.push(`https:${reply.posts.post[count].$.file_url}`)
              msg.channel.sendMessage(FurryArray.join('\n'))
            }
          })
        }
      })
  }
}

Commands.meme = {
  name: 'meme',
  help: 'I\'ll create a meme with your suffixes!',
  timeout: 10,
  usage: '<memetype> "<Upper line>" "<Bottom line>" **Quotes are important!**',
  level: 0,
  fn: function (msg, suffix, bot) {
    var tags = suffix.split('"')
    var memetype = tags[0].split(' ')[0]
    var meme = require('./memes.json')
    var Imgflipper = require('imgflipper')
    var imgflipper = new Imgflipper(config.api_keys.imgflip.username, config.api_keys.imgflip.password)
    imgflipper.generateMeme(meme[memetype], tags[1] ? tags[1] : '', tags[3] ? tags[3] : '', (err, image) => {
      if (err) {
        msg.reply('Please try again, use `help meme` if you do not know how to use this command.')
      } else {
        var channel = msg.channel
        var user = bot.User
        if (msg.isPrivate) {
          msg.reply(image)
        } else if (user.permissionsFor(channel).Text.MANAGE_MESSAGES) {
          msg.delete()
          msg.reply(image)
        } else {
          msg.reply(image)
        }
      }
    })
  }
}

Commands.xkcd = {
  name: 'xkcd',
  help: 'I\'ll get a XKCD comic for you, you can define a comic number and I\'ll fetch that one.',
  timeout: 10,
  usage: 'Nothing for a random comic, current for latest, number to get that comic.',
  level: 0,
  fn: function (msg, suffix) {
    var xkcdInfo
    request.get('http://xkcd.com/info.0.json')
      .end((error, response) => {
        if (!error && response.status === 200) {
          xkcdInfo = response.body
          if (suffix.toLowerCase() === 'current') {
            msg.reply(`**Alternate text (shown on mouse over)**\n ${xkcdInfo.alt}\n\n${xkcdInfo.img}`)
          } else if (!suffix) {
            var xkcdRandom = Math.floor(Math.random() * (xkcdInfo.num - 1)) + 1
            request.get(`http://xkcd.com/${xkcdRandom}/info.0.json`)
              .end((error, response) => {
                if (!error && response.status === 200) {
                  xkcdInfo = response.body
                  msg.reply(`**Alternate text (shown on mouse over)**\n ${xkcdInfo.alt}\n\n${xkcdInfo.img}`)
                } else {
                  msg.reply('Please try again later.')
                  Logger.error(`Got an error: ${error}, status code: ${response.status}`)
                }
              })
          } else if (!isNaN(parseInt(suffix, 10)) && parseInt(suffix, 10) > 0 && (parseInt(suffix, 10) <= xkcdInfo.num)) {
            request(`http://xkcd.com/${suffix}/info.0.json`)
              .end((error, response) => {
                if (!error && response.status === 200) {
                  xkcdInfo = response.body
                  msg.reply(`**Alternate text (shown on mouse over)**\n ${xkcdInfo.alt}\n\n${xkcdInfo.img}`)
                } else {
                  msg.reply('Please try again later.')
                  Logger.error(`Got an error: ${error}, status code: ${response.status}`)
                }
              })
          } else {
            msg.reply(`There are only ${xkcdInfo.num} xkcd comics!`)
          }
        } else {
          msg.reply('Please try again later.')
          Logger.error(`Got an error: ${error}, status code: ${response.status}`)
        }
      })
  }
}

Commands.magic8ball = {
  name: 'magic8ball',
  help: 'I\'ll make a prediction using a Magic 8 Ball',
  aliases: ['8ball'],
  timeout: 5,
  level: 0,
  fn: function (msg, suffix) {
    if (!suffix) {
      msg.reply('I mean I can shake this 8ball all I want but without a question it\'s kinda dumb.')
      return
    }
    var answers = [
      'Signs point to yes.',
      'Yes.',
      'Reply hazy, try again.',
      'Without a doubt.',
      'My sources say no.',
      'As I see it, yes.',
      'You may rely on it.',
      'Concentrate and ask again.',
      'Outlook not so good.',
      'It is decidedly so.',
      'Better not tell you now.',
      'Very doubtful.',
      'Yes - definitely.',
      'It is certain.',
      'Cannot predict now.',
      'Most likely.',
      'Ask again later.',
      'My reply is no.',
      'Outlook good.',
      'Don\'t count on it.',
      'Who cares?',
      'Never, ever, ever.',
      'Possibly.',
      'There is a small chance.'
    ]
    var answer = answers[Math.floor(Math.random() * answers.length)]
    msg.channel.sendMessage('The Magic 8 Ball says:\n```' + answer + '```')
  }
}

Commands.randommeme = {
  name: 'randommeme',
  help: 'I\'ll get a random meme for you!',
  level: '0',
  nsfw: true,
  fn: function (msg) {
    request.get(`https://api.imgur.com/3/g/memes/viral/${Math.floor((Math.random() * 8) + 1)}`) // 20 Memes per page, 160 Memes
      .set('Authorization', 'Client-ID ' + config.api_keys.imgur)
      .end(function (err, result) {
        if (!err && !result.body.data.error) {
          msg.channel.sendMessage(result.body.data[Math.floor((Math.random() * 20) + 1)].link)
        } else {
          Logger.error(result.body.data.error)
        }
      })
  }
}

Commands.shorten = {
  name: 'shorten',
  help: 'Shorten an url using goo.gl.',
  timeout: 10,
  level: 0,
  fn: function (msg, suffix) {
    var url = require('url')
    if (suffix.length === 0) {
      msg.reply('Enter an url!')
      return
    }
    if (url.parse(suffix).hostname) {
      request.post(`https://www.googleapis.com/urlshortener/v1/url`)
        .query({key: config.api_keys.google})
        .send({longUrl: suffix})
        .set('Content-Type', 'application/json')
        .end(function (err, res) {
          if (!err) {
            msg.channel.sendMessage(`:link: Shortened URL: **${res.body.id}**`)
          } else {
            Logger.debug(`Got an error: ${err}, status code: ${res.status}`)
          }
        })
    } else {
      msg.reply('This is not a valid url.')
    }
  }
}

Commands.price = {
  name: 'price',
  help: "Current price from coinmarketcap.com !",
  aliases: ['price'],
  timeout: 5,
  level: 0,
  fn: function (msg, suffix) {
    var tags     = suffix.split(/\s+/);
    var fr       = '';
    var from     = '';
    var template = {
      'title'       : 'Full name of Coin',
      'description' : 'Symbol',
      'color'       : 431042,
      'thumbnail'   : {
        'url' : 'https://files.coinmarketcap.com/static/img/coins/32x32/'
      },
      'image' : {
        'url' : ''
      },
      'author' : {
        'name'     : 'CoinMarketCap',
        'url'      : 'http://coinmarketcap.com',
        'icon_url' : 'https://coinmarketcap.com/static/img/CoinMarketCap.png'
      },
      'fields' : []
    };

    if (typeof tags[0] === 'undefined' || tags[0] === '') {
      msg.channel.sendMessage('Whoops, not a valid request.');
      return;
    }

    fr   = tags[0].toUpperCase();
    from = cryptos[fr];

    request.get('https://api.coinmarketcap.com/v1/ticker/' + from)
    .end((err, res) => {
      if (!err && res.status === 200) {
        var r = _.head(res.body);

        template.title = _.startCase(from);
        template.thumbnail.url += from + '.png';
        template.description = fr;

        if (from !== 'bitcoin') {
          template.fields.push({
            name   : 'Price USD',
            value  : '$' + r.price_usd,
            inline : true
          });

          template.fields.push({
            name   : 'Price BTC',
            value  : r.price_btc + ' BTC',
            inline : true
          })
        } else {
          template.fields.push({
            name   : 'Price USD',
            value  : '$' + r.price_usd
          });
        }

        if (r.percent_change_7d.charAt(0) !== '-') {
          r.percent_change_7d = '+' + r.percent_change_7d;
        }

        if (r.percent_change_24h.charAt(0) !== '-') {
          r.percent_change_24h = '+' + r.percent_change_24h;
        }

        if (r.percent_change_1h.charAt(0) !== '-') {
          r.percent_change_1h = '+' + r.percent_change_1h;
        }

        template.fields.push({
          name  : 'Last 7 Days Change',
          value : '```diff\n' + r.percent_change_7d + '%\n```'
        });

        template.fields.push({
          name  : 'Last Day Change',
          value : '```diff\n' + r.percent_change_24h + '%\n```'
        });

        template.fields.push({
          name  : 'Last Hour Change',
          value : '```diff\n' + r.percent_change_1h + '%\n```'
        });

        template.fields.push({
          name   : 'Rank',
          value  : r.rank,
          inline : true
        });

        template.fields.push({
          name   : 'Volume',
          value  : numeral(r['24h_volume_usd']).format('$0.00a'),
          inline : true
        });

        msg.channel.sendMessage('', false, template);
      } else {
        Logger.error(`Got an error: ${err}, status code: ${res.status}`);
      }
    });
  }
};

exports.Commands = Commands
