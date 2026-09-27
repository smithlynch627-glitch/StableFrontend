// Marketplace & Launchpad FAQ (EN / KO). {market} and {mint} are replaced with the live fees from the contracts.
import type { Lang } from '../i18n';

export interface FaqItem { q: string; a: string[] }
export interface FaqGroup { id: 'marketplace' | 'launchpad' | 'safety'; title: string; intro: string; items: FaqItem[] }

const EN: FaqGroup[] = [
  {
    id: 'marketplace',
    title: 'Marketplace',
    intro: 'Buying, selling, offers and fees on STABLE.',
    items: [
      { q: 'What is STABLE?', a: [
        'STABLE is the native NFT launchpad and marketplace on GIWA, the Ethereum Layer 2 built by Upbit on the OP Stack. You can launch a collection, mint, list, buy, make offers and track activity in one place.',
        'STABLE runs on GIWA Sepolia (testnet) today and moves to GIWA mainnet when it launches. Testnet assets have no real value.',
      ] },
      { q: 'Which wallet can I use?', a: [
        'Any EVM browser wallet works: MetaMask, Rabby, OKX Wallet, Coinbase / Base Wallet and others. When you connect, STABLE asks your wallet to add or switch to the GIWA network (chain ID 91342 on testnet).',
        'Signing in is a free signature that proves you own the wallet. It never moves funds and never costs gas.',
      ] },
      { q: 'How do I get ETH on GIWA?', a: [
        'On testnet, use the GIWA Sepolia faucet or bridge Sepolia ETH through the official GIWA bridge (see docs.giwa.io). On mainnet you will bridge ETH from Ethereum or withdraw from Upbit to GIWA.',
      ] },
      { q: 'What fees do I pay?', a: [
        'Buyers pay exactly the listed price plus network gas. From each sale, the marketplace fee ({market}) and the creator royalty (set by the creator, at most 10%) are taken, and the rest goes to the seller in the same transaction.',
        'The marketplace fee can never exceed 10%, and it can never be higher than the fee you agreed to when you signed your listing. If it changes, older listings are not charged more.',
      ] },
      { q: 'How do I list an NFT for sale?', a: [
        'Open the item and press List. The first time for each collection your wallet approves the marketplace (one small transaction). After that, every listing is a free signature that shows the item, price and expiry in your wallet.',
        'To list many items at once, open your profile or a collection, press Select, pick your items and choose List.',
      ] },
      { q: 'How do I buy, or buy several at once?', a: [
        'Press Buy and confirm in your wallet: the NFT and all payouts move in one transaction. If someone bought it a moment earlier, your transaction fails and nothing is charged except gas.',
        'Sweeping buys up to 50 listings in one transaction. Items that are no longer available are skipped and the unused ETH is refunded automatically.',
      ] },
      { q: 'How do offers work?', a: [
        'Offers are paid in WETH (wrapped ETH), so the ETH stays in your wallet until an owner accepts. STABLE can wrap ETH for you. A collection offer can be accepted with any item of that collection.',
        'The owner accepts with one transaction and receives the WETH minus the fees. Keep enough WETH and allowance, or your offer shows as inactive.',
      ] },
      { q: 'How do I cancel a listing or an offer?', a: [
        'Cancel it from the item page or your profile. Cancelling is an on-chain transaction (small gas) so the old signature can never be used again. "Cancel all" invalidates every listing and offer you signed before, in one transaction.',
        'Transferring or selling the NFT elsewhere also makes its listing unfillable.',
      ] },
      { q: 'Why is my NFT or its image not showing yet?', a: [
        'New mints and sales appear within seconds. Images come from IPFS and can take a while the first time. Open the item and press Refresh metadata. If it still does not load, the collection metadata may be broken; contact the creator or Support.',
      ] },
      { q: 'What do the rarity rank and badges mean?', a: [
        'The rank (#1 is rarest) is calculated from how rare each trait is inside the collection. A gold tick means the STABLE team verified the collection. "Official" marks STABLE\'s own collection, GIWA COWS.',
      ] },
    ],
  },
  {
    id: 'launchpad',
    title: 'Launchpad',
    intro: 'Launching your own collection, mint phases and payouts.',
    items: [
      { q: 'What is the STABLE launchpad?', a: [
        'It deploys your own ERC-721 collection contract on GIWA without code. You own the contract; STABLE never holds your art or your funds. The collection is tradable on the marketplace as soon as the first item is minted.',
      ] },
      { q: 'What do I need before I start?', a: [
        'A wallet with a little ETH for gas, an X account to connect, a link to your logo (and optionally a banner), and your art: either one pre-reveal image link, or an IPFS folder with your metadata. Launching costs only network gas.',
      ] },
      { q: 'Why do I have to connect X?', a: [
        'Collectors see a real, connected X account on your collection instead of a typed link that anyone could fake. STABLE only reads your @username once; it never posts, never reads your timeline or followers, and gives the access back to X immediately.',
      ] },
      { q: 'How do I add my logo, banner and pre-reveal image?', a: [
        'Upload the image to IPFS (for example Pinata) or any https host and paste the link. Recommended sizes: logo 400 × 400, banner 1500 × 500, pre-reveal 1000 × 1000. PNG, JPG, GIF and WebP all work.',
        'For the pre-reveal you can also paste a metadata link: a JSON file with "name", "description" and "image".',
      ] },
      { q: 'What is a pre-reveal and how do I reveal?', a: [
        'With a pre-reveal, every token shows the same placeholder until you reveal. When your art is ready, upload the metadata folder to IPFS and press Reveal in the Studio. That is one transaction, and wallets and marketplaces then show the real art.',
      ] },
      { q: 'How must my metadata folder look?', a: [
        'One JSON file per token: 1.json, 2.json … up to your supply. Each file has "name", "description", "image" (pointing inside your images folder, like ipfs://<images CID>/1.png) and "attributes" for traits.',
        'Paste the folder link with a slash at the end: ipfs://<metadata CID>/. Before you deploy, STABLE opens tokens 1, 2, 3 and the last one so you see exactly what collectors will see.',
      ] },
      { q: 'How do mint phases work?', a: [
        'Add phases such as GTD, Allowlist and Public. Each phase has a start and end time, a price and a per-wallet limit. Allowlist phases only accept the wallets you add (checked on-chain with a Merkle proof). The last phase is always Public and open to everyone.',
      ] },
      { q: 'Can I change the mint after launch?', a: [
        'Yes, in the Studio you can edit phase times, prices and limits, pause minting, reduce (never increase) the max supply, reveal, and freeze metadata for good. Changes made after minting started are shown to collectors on the mint page.',
      ] },
      { q: 'How and when do I get paid?', a: [
        'Mint payments go to your payout wallet in the same transaction as the mint, minus the platform fee ({mint}). On every marketplace sale you receive your royalty (up to 10%) automatically.',
      ] },
      { q: 'How does a collection get the gold verified tick?', a: [
        'The STABLE team reviews collections with a real team, a connected X account and working metadata. Contact Support from your creator wallet to request a review.',
      ] },
    ],
  },
  {
    id: 'safety',
    title: 'Wallet safety',
    intro: 'How STABLE protects you, and how to protect yourself.',
    items: [
      { q: 'Is it safe to approve the marketplace?', a: [
        'The marketplace contract can only move an NFT when its owner signed a listing for that exact item at that exact price, or when you accept an offer yourself. There is no admin function that can move user assets, and the contracts are owned by a 2-of-3 multisig.',
        'You can see and revoke every approval on the Security page at any time.',
      ] },
      { q: 'What should I never sign?', a: [
        'STABLE never asks for your seed phrase or private key. Only use stablemarket.art. Listings and offers show the collection, item and price in your wallet; if a request is a blind hash or asks for "setApprovalForAll" on a site you do not trust, reject it.',
      ] },
      { q: 'I think my wallet is compromised. What now?', a: [
        'Move your assets to a new wallet from a clean device, revoke approvals on the Security page, and press "Cancel all" to invalidate your open listings and offers. Then contact Support.',
      ] },
    ],
  },
];

const KO: FaqGroup[] = [
  {
    id: 'marketplace',
    title: '마켓플레이스',
    intro: 'STABLE에서의 구매, 판매, 오퍼, 수수료 안내.',
    items: [
      { q: 'STABLE은 무엇인가요?', a: [
        'STABLE은 업비트가 OP Stack으로 만든 이더리움 레이어 2인 GIWA의 네이티브 NFT 런치패드이자 마켓플레이스입니다. 컬렉션 출시, 민팅, 리스팅, 구매, 오퍼, 활동 확인을 한곳에서 할 수 있습니다.',
        '지금은 GIWA Sepolia(테스트넷)에서 운영되며 GIWA 메인넷 출시와 함께 메인넷으로 이전합니다. 테스트넷 자산은 실제 가치가 없습니다.',
      ] },
      { q: '어떤 지갑을 쓸 수 있나요?', a: [
        'MetaMask, Rabby, OKX Wallet, Coinbase / Base Wallet 등 모든 EVM 브라우저 지갑을 쓸 수 있습니다. 연결하면 GIWA 네트워크(테스트넷 체인 ID 91342)를 추가하거나 전환하도록 요청합니다.',
        '로그인은 지갑 소유를 증명하는 무료 서명입니다. 자산을 옮기지 않으며 가스비도 들지 않습니다.',
      ] },
      { q: 'GIWA에서 ETH는 어떻게 받나요?', a: [
        '테스트넷에서는 GIWA Sepolia 파우셋을 쓰거나 공식 GIWA 브리지로 Sepolia ETH를 옮기세요(docs.giwa.io 참고). 메인넷에서는 이더리움에서 브리지하거나 업비트에서 GIWA로 출금하면 됩니다.',
      ] },
      { q: '수수료는 얼마인가요?', a: [
        '구매자는 리스팅 가격과 네트워크 가스비만 냅니다. 판매 금액에서 마켓 수수료({market})와 크리에이터 로열티(크리에이터가 정함, 최대 10%)가 빠지고 나머지는 같은 트랜잭션에서 판매자에게 지급됩니다.',
        '마켓 수수료는 10%를 넘을 수 없고, 리스팅에 서명할 때 동의한 수수료보다 높아질 수 없습니다. 수수료가 바뀌어도 이전 리스팅에 더 많이 부과되지 않습니다.',
      ] },
      { q: 'NFT는 어떻게 판매 등록하나요?', a: [
        '아이템을 열고 리스팅을 누르세요. 컬렉션마다 처음 한 번은 마켓플레이스 승인 트랜잭션(소액 가스)이 필요합니다. 그 뒤 모든 리스팅은 아이템, 가격, 만료가 지갑에 표시되는 무료 서명입니다.',
        '여러 아이템을 한 번에 등록하려면 프로필이나 컬렉션에서 선택을 누르고 아이템을 고른 뒤 리스팅을 선택하세요.',
      ] },
      { q: '구매하거나 여러 개를 한 번에 사려면?', a: [
        '구매를 누르고 지갑에서 확인하면 NFT와 모든 지급이 한 트랜잭션에서 처리됩니다. 누군가 먼저 샀다면 트랜잭션이 실패하고 가스비 외에는 청구되지 않습니다.',
        '스윕은 한 트랜잭션으로 최대 50개 리스팅을 구매합니다. 더 이상 구매할 수 없는 아이템은 건너뛰고 남은 ETH는 자동 환불됩니다.',
      ] },
      { q: '오퍼는 어떻게 작동하나요?', a: [
        '오퍼는 WETH(래핑된 ETH)로 하므로 소유자가 수락할 때까지 ETH가 지갑에 그대로 있습니다. STABLE이 ETH 래핑을 도와줍니다. 컬렉션 오퍼는 해당 컬렉션의 어떤 아이템으로도 수락할 수 있습니다.',
        '소유자는 트랜잭션 한 번으로 수락하고 수수료를 뺀 WETH를 받습니다. WETH 잔액과 허용량이 부족하면 오퍼가 비활성으로 표시됩니다.',
      ] },
      { q: '리스팅이나 오퍼는 어떻게 취소하나요?', a: [
        '아이템 페이지나 프로필에서 취소하세요. 취소는 온체인 트랜잭션(소액 가스)이라 이전 서명을 다시 쓸 수 없게 됩니다. "모두 취소"는 이전에 서명한 모든 리스팅과 오퍼를 한 번에 무효화합니다.',
        'NFT를 다른 곳에서 전송하거나 판매해도 해당 리스팅은 체결되지 않습니다.',
      ] },
      { q: '내 NFT나 이미지가 아직 안 보여요', a: [
        '새 민팅과 판매는 몇 초 안에 표시됩니다. 이미지는 IPFS에서 불러오므로 처음에는 시간이 걸릴 수 있습니다. 아이템을 열고 메타데이터 새로고침을 누르세요. 그래도 안 되면 컬렉션 메타데이터 문제일 수 있으니 크리에이터나 고객지원에 문의하세요.',
      ] },
      { q: '희귀도 순위와 배지는 무엇인가요?', a: [
        '순위(#1이 가장 희귀)는 컬렉션 안에서 각 특성이 얼마나 드문지로 계산합니다. 금색 체크는 STABLE 팀이 인증한 컬렉션이며, "공식"은 STABLE의 컬렉션인 GIWA COWS를 뜻합니다.',
      ] },
    ],
  },
  {
    id: 'launchpad',
    title: '런치패드',
    intro: '나만의 컬렉션 출시, 민팅 단계, 정산 안내.',
    items: [
      { q: 'STABLE 런치패드는 무엇인가요?', a: [
        '코드 없이 GIWA에 나만의 ERC-721 컬렉션 컨트랙트를 배포합니다. 컨트랙트는 본인 소유이며 STABLE은 아트나 자금을 보관하지 않습니다. 첫 아이템이 민팅되는 즉시 마켓플레이스에서 거래할 수 있습니다.',
      ] },
      { q: '시작하기 전에 무엇이 필요한가요?', a: [
        '가스비용 소량의 ETH가 있는 지갑, 연결할 X 계정, 로고 이미지 링크(배너는 선택), 그리고 아트: 사전 공개 이미지 링크 하나 또는 메타데이터가 담긴 IPFS 폴더. 출시 비용은 네트워크 가스비뿐입니다.',
      ] },
      { q: '왜 X를 연결해야 하나요?', a: [
        '누구나 속일 수 있는 입력 링크 대신 실제로 연결된 X 계정이 컬렉션에 표시되어 컬렉터가 믿을 수 있습니다. STABLE은 @사용자명만 한 번 읽고, 글을 올리거나 타임라인·팔로워를 읽지 않으며 접근 권한을 즉시 X에 반환합니다.',
      ] },
      { q: '로고, 배너, 사전 공개 이미지는 어떻게 넣나요?', a: [
        '이미지를 IPFS(예: Pinata)나 https 호스팅에 올리고 링크를 붙여넣으세요. 권장 크기: 로고 400 × 400, 배너 1500 × 500, 사전 공개 1000 × 1000. PNG, JPG, GIF, WebP 모두 가능합니다.',
        '사전 공개에는 "name", "description", "image"가 들어 있는 메타데이터 JSON 링크를 붙여넣을 수도 있습니다.',
      ] },
      { q: '사전 공개(프리리빌)와 공개는 어떻게 하나요?', a: [
        '사전 공개 상태에서는 모든 토큰이 같은 대체 이미지를 보여줍니다. 아트가 준비되면 메타데이터 폴더를 IPFS에 올리고 스튜디오에서 공개를 누르세요. 트랜잭션 한 번으로 지갑과 마켓에 실제 아트가 표시됩니다.',
      ] },
      { q: '메타데이터 폴더는 어떤 형식이어야 하나요?', a: [
        '토큰마다 JSON 파일 하나: 1.json, 2.json … 발행량까지. 각 파일에는 "name", "description", 이미지 폴더 안을 가리키는 "image"(예: ipfs://<이미지 CID>/1.png), 특성용 "attributes"가 있습니다.',
        '폴더 링크는 끝에 슬래시를 붙여 넣으세요: ipfs://<메타데이터 CID>/. 배포 전에 STABLE이 1, 2, 3번과 마지막 토큰을 열어 컬렉터가 볼 화면을 보여줍니다.',
      ] },
      { q: '민팅 단계는 어떻게 작동하나요?', a: [
        'GTD, 화이트리스트, 퍼블릭 같은 단계를 추가하세요. 단계마다 시작·종료 시간, 가격, 지갑당 한도가 있습니다. 화이트리스트 단계는 추가한 지갑만 민팅할 수 있으며 온체인 머클 증명으로 확인합니다. 마지막 단계는 항상 모두에게 열린 퍼블릭입니다.',
      ] },
      { q: '출시 후에도 민팅 설정을 바꿀 수 있나요?', a: [
        '네. 스튜디오에서 단계 시간, 가격, 한도를 수정하고, 민팅을 일시정지하고, 최대 발행량을 줄이고(늘릴 수는 없음), 공개하고, 메타데이터를 영구 고정할 수 있습니다. 민팅 시작 후의 변경은 민팅 페이지에 컬렉터에게 표시됩니다.',
      ] },
      { q: '정산은 언제, 어떻게 받나요?', a: [
        '민팅 대금은 플랫폼 수수료({mint})를 제외하고 민팅과 같은 트랜잭션에서 정산 지갑으로 바로 들어옵니다. 마켓플레이스 판매마다 로열티(최대 10%)도 자동으로 받습니다.',
      ] },
      { q: '금색 인증 체크는 어떻게 받나요?', a: [
        'STABLE 팀이 실제 팀, 연결된 X 계정, 정상 메타데이터를 갖춘 컬렉션을 검토합니다. 크리에이터 지갑으로 고객지원에 검토를 요청하세요.',
      ] },
    ],
  },
  {
    id: 'safety',
    title: '지갑 보안',
    intro: 'STABLE의 보호 방식과 스스로를 지키는 방법.',
    items: [
      { q: '마켓플레이스를 승인해도 안전한가요?', a: [
        '마켓플레이스 컨트랙트는 소유자가 그 아이템을 그 가격에 판매한다고 서명했거나 본인이 오퍼를 수락할 때만 NFT를 옮길 수 있습니다. 사용자 자산을 옮기는 관리자 기능은 없으며 컨트랙트는 2-of-3 멀티시그가 소유합니다.',
        '보안 페이지에서 언제든 모든 승인을 확인하고 취소할 수 있습니다.',
      ] },
      { q: '무엇에 서명하면 안 되나요?', a: [
        'STABLE은 시드 문구나 개인 키를 절대 요구하지 않습니다. stablemarket.art만 사용하세요. 리스팅과 오퍼는 지갑에 컬렉션, 아이템, 가격이 표시됩니다. 내용이 보이지 않는 해시 서명이나 신뢰할 수 없는 사이트의 "setApprovalForAll" 요청은 거절하세요.',
      ] },
      { q: '지갑이 해킹된 것 같아요. 어떻게 하나요?', a: [
        '깨끗한 기기에서 자산을 새 지갑으로 옮기고, 보안 페이지에서 승인을 취소하고, "모두 취소"로 열린 리스팅과 오퍼를 무효화하세요. 그다음 고객지원에 문의하세요.',
      ] },
    ],
  },
];

export const faqGroups = (lang: Lang, fees: { market?: number | null; mint?: number | null }): FaqGroup[] => {
  const pct = (bps?: number | null, fallback = '') => (bps === null || bps === undefined ? fallback : `${bps / 100}%`);
  const rate = lang === 'ko' ? '현재 요율' : 'current rate';
  const fill = (s: string) => s.split('{market}').join(pct(fees.market, rate)).split('{mint}').join(pct(fees.mint, rate));
  return (lang === 'ko' ? KO : EN).map((g) => ({ ...g, items: g.items.map((it) => ({ q: it.q, a: it.a.map(fill) })) }));
};
