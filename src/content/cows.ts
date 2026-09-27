// GIWA COWS page content (EN / KO). Edit this file to update the facts, roadmap or FAQ.
// Roadmap items: set `done: true` when an item ships and it shows a check mark on the page.
import type { Lang } from '../i18n';
import type { FaqItem } from './faq';

export type PhaseStatus = 'now' | 'next' | 'later' | 'done';
export interface RoadmapItem { text: string; done?: boolean }
export interface RoadmapPhase { id: 'I' | 'II' | 'III'; name: string; stage: string; status: PhaseStatus; items: RoadmapItem[] }
export interface CowsFact { label: string; value: string; note: string }
export interface CowsPillar { title: string; body: string }

export interface CowsContent {
  eyebrow: string;
  lead: string;
  facts: CowsFact[];
  aboutTitle: string;
  aboutLead: string;
  pillars: CowsPillar[];
  utilityKicker: string;
  utilityTitle: string;
  utilityLead: string;
  utilitySlot: string;
  artsTitle: string;
  artsLead: string;
  roadmapTitle: string;
  roadmapLead: string;
  status: Record<PhaseStatus, string>;
  roadmap: RoadmapPhase[];
  faqTitle: string;
  faqLead: string;
  faq: FaqItem[];
  joinTitle: string;
  joinBody: string;
  nav: { overview: string; market: string; utility: string; arts: string; roadmap: string; faq: string };
  ticker: string[];
}

/** Supply is fixed in the collection contract; it can never be raised. */
export const COWS_SUPPLY = 3333;

const EN: CowsContent = {
  eyebrow: 'Official collection of StableMarket',
  lead: '3,333 hand-drawn cows living on GIWA. The official NFT collection of StableMarket, growing together with the marketplace and its community.',
  facts: [
    { label: 'Supply', value: '3,333', note: 'Fixed forever' },
    { label: 'Mint price', value: 'TBA', note: 'Announced before mint' },
    { label: 'Mint date', value: 'Near mainnet', note: 'Announced close to GIWA mainnet' },
    { label: 'Status', value: 'Official', note: 'Collection of StableMarket' },
  ],
  aboutTitle: 'Why the herd',
  aboutLead: 'GIWA COWS is the collection the marketplace itself stands behind.',
  pillars: [
    { title: 'Official', body: 'The official collection of StableMarket, marked with the gold tick everywhere on the site.' },
    { title: 'Fixed supply', body: '3,333 cows, set in the contract. No second batch and no extra mint, ever.' },
    { title: 'Fair mint', body: 'Exact on-chain price, per-wallet limits and allowlist proofs enforced by the contract.' },
    { title: 'Native to GIWA', body: 'Minted and traded on GIWA, the Upbit L2, with low fees and fast blocks.' },
  ],
  utilityKicker: 'Holder utility',
  utilityTitle: 'Reveal soon',
  utilityLead: 'What GIWA COWS unlocks is still under wraps. Each utility is revealed on our official X first, then here.',
  utilitySlot: 'Utility',
  artsTitle: 'GIWA COW Arts',
  artsLead: 'A first look at the herd. Every cow is one of a kind.',
  roadmapTitle: 'Roadmap',
  roadmapLead: 'From the first testnet trade to mainnet and beyond.',
  status: { now: 'In progress', next: 'Next', later: 'Later', done: 'Done' },
  roadmap: [
    {
      id: 'I', name: 'Phase I', stage: 'Testnet phase', status: 'now',
      items: [
        { text: 'Launch the native marketplace on GIWA with every dedicated marketplace function', done: true },
        { text: 'Introduce GIWA COWS as the official collection of the native marketplace' },
        { text: 'Introduce the GIWA COWS community socials' },
        { text: 'Start distributing the GIWA COWS mint allowlist' },
        { text: 'Launch a points program for using the NFT marketplace' },
        { text: 'Launch the partnership program' },
        { text: 'Launch the Ambassador Program' },
      ],
    },
    {
      id: 'II', name: 'Phase II', stage: 'Mainnet phase', status: 'next',
      items: [
        { text: 'Switch the marketplace to GIWA mainnet' },
        { text: 'Launch the first native NFT collection on GIWA' },
      ],
    },
    {
      id: 'III', name: 'Phase III', stage: 'Expansion', status: 'later',
      items: [
        { text: 'Introduce NFT utility' },
        { text: 'Launch the $STABLE token' },
        { text: 'Use cases across the ecosystem' },
        { text: 'DEX features, and more' },
      ],
    },
  ],
  faqTitle: 'Collection FAQ',
  faqLead: 'Everything about GIWA COWS in one place.',
  faq: [
    { q: 'What is GIWA COWS?', a: [
      'GIWA COWS is the official NFT collection of StableMarket (STABLE): 3,333 hand-drawn cows on GIWA. It is the collection the marketplace itself stands behind, and it carries the gold tick across the site.',
    ] },
    { q: 'How many GIWA COWS will there be?', a: [
      '3,333, fixed. The maximum supply is written into the collection contract and can never be raised. There is no second batch.',
    ] },
    { q: 'What is the mint price?', a: [
      'The mint price is to be announced. It will be published on the official GIWA COWS X account and on this page before the mint opens.',
      'When you mint, your wallet always shows the exact price before you confirm. The contract only accepts the exact amount.',
    ] },
    { q: 'When is the mint?', a: [
      'The mint date will be announced close to the GIWA mainnet launch. Follow the official X account and turn on notifications so you do not miss it.',
    ] },
    { q: 'How do I get on the allowlist?', a: [
      'Allowlist distribution starts in Phase I, during the testnet phase. How spots are given out is announced on the official GIWA COWS socials, round by round.',
      'Allowlist spots are never sold in DMs. Anyone asking you to pay for a spot or to sign something to "claim" one is a scammer.',
    ] },
    { q: 'What utility do holders get?', a: [
      'Utility is being revealed soon. Phase III of the roadmap brings NFT utility, the $STABLE token, use cases and DEX features. Every piece is announced on our official X first.',
    ] },
    { q: 'Which network and wallet do I need?', a: [
      'GIWA COWS lives on GIWA, the Ethereum Layer 2 by Upbit. Any EVM wallet works (MetaMask, Rabby, OKX Wallet and others). STABLE adds the GIWA network to your wallet when you connect.',
    ] },
    { q: 'How do I know I am minting the real GIWA COWS?', a: [
      'Only mint from stablemarket.art/giwa-cows. The official collection shows the gold tick, and the contract address will be published on this page and on the official X before the mint.',
      'We will never DM you a mint link, and we never ask for your seed phrase.',
    ] },
    { q: 'Where can I trade GIWA COWS after the mint?', a: [
      'Right here on StableMarket. You can list, buy, sweep the floor and make offers on single cows or on the whole collection, the moment the mint starts.',
    ] },
  ],
  joinTitle: 'Join the herd',
  joinBody: 'Allowlist rounds, the mint date and the utility reveal land on our official X first.',
  nav: { overview: 'Overview', market: 'Market', utility: 'Utility', arts: 'Arts', roadmap: 'Roadmap', faq: 'FAQ' },
  ticker: ['GIWA COWS', '3,333 supply', 'Official collection', 'Mint price TBA', 'Mint near mainnet', 'Built on GIWA'],
};

const KO: CowsContent = {
  eyebrow: 'StableMarket 공식 컬렉션',
  lead: 'GIWA에 사는 손으로 그린 3,333마리의 소. 마켓플레이스와 커뮤니티와 함께 성장하는 StableMarket의 공식 NFT 컬렉션입니다.',
  facts: [
    { label: '발행량', value: '3,333', note: '영구 고정' },
    { label: '민팅 가격', value: 'TBA', note: '민팅 전 공개' },
    { label: '민팅 일정', value: '메인넷 즈음', note: 'GIWA 메인넷 직전 공개' },
    { label: '상태', value: '공식', note: 'StableMarket 컬렉션' },
  ],
  aboutTitle: '왜 GIWA COWS인가',
  aboutLead: 'GIWA COWS는 마켓플레이스가 직접 보증하는 컬렉션입니다.',
  pillars: [
    { title: '공식 컬렉션', body: 'StableMarket의 공식 컬렉션으로, 사이트 전체에서 금색 체크로 표시됩니다.' },
    { title: '고정 발행량', body: '컨트랙트에 3,333마리로 고정되어 있습니다. 추가 발행이나 2차 배치는 없습니다.' },
    { title: '공정한 민팅', body: '정확한 온체인 가격, 지갑별 한도, 허용 목록 증명을 컨트랙트가 강제합니다.' },
    { title: 'GIWA 네이티브', body: 'Upbit L2인 GIWA에서 낮은 수수료와 빠른 블록으로 민팅하고 거래합니다.' },
  ],
  utilityKicker: '홀더 유틸리티',
  utilityTitle: '곧 공개',
  utilityLead: 'GIWA COWS가 여는 혜택은 아직 비공개입니다. 각 유틸리티는 공식 X에서 먼저 공개된 뒤 이곳에 추가됩니다.',
  utilitySlot: '유틸리티',
  artsTitle: 'GIWA COW 아트',
  artsLead: '먼저 만나보는 소 떼. 모든 소는 단 하나뿐입니다.',
  roadmapTitle: '로드맵',
  roadmapLead: '첫 테스트넷 거래부터 메인넷, 그리고 그 너머까지.',
  status: { now: '진행 중', next: '다음', later: '예정', done: '완료' },
  roadmap: [
    {
      id: 'I', name: '1단계', stage: '테스트넷 단계', status: 'now',
      items: [
        { text: '마켓플레이스 전용 기능을 모두 갖춘 GIWA 네이티브 마켓플레이스 출시', done: true },
        { text: 'GIWA COWS를 네이티브 마켓플레이스의 공식 컬렉션으로 공개' },
        { text: 'GIWA COWS 커뮤니티 소셜 오픈' },
        { text: 'GIWA COWS 민팅 허용 목록 배포 시작' },
        { text: 'NFT 마켓플레이스 이용 포인트 프로그램 출시' },
        { text: '파트너십 프로그램 출시' },
        { text: '앰배서더 프로그램 출시' },
      ],
    },
    {
      id: 'II', name: '2단계', stage: '메인넷 단계', status: 'next',
      items: [
        { text: '마켓플레이스를 GIWA 메인넷으로 전환' },
        { text: 'GIWA 최초의 네이티브 NFT 컬렉션 출시' },
      ],
    },
    {
      id: 'III', name: '3단계', stage: '확장', status: 'later',
      items: [
        { text: 'NFT 유틸리티 도입' },
        { text: '$STABLE 토큰 출시' },
        { text: '생태계 전반의 활용 사례' },
        { text: 'DEX 기능 등' },
      ],
    },
  ],
  faqTitle: '컬렉션 FAQ',
  faqLead: 'GIWA COWS에 대한 모든 것을 한곳에.',
  faq: [
    { q: 'GIWA COWS는 무엇인가요?', a: [
      'GIWA COWS는 StableMarket(STABLE)의 공식 NFT 컬렉션으로, GIWA에 사는 손으로 그린 3,333마리의 소입니다. 마켓플레이스가 직접 보증하는 컬렉션이며 사이트 전체에서 금색 체크가 표시됩니다.',
    ] },
    { q: '총 몇 마리가 발행되나요?', a: [
      '3,333마리로 고정입니다. 최대 발행량은 컬렉션 컨트랙트에 기록되어 있어 절대 늘릴 수 없고, 2차 배치도 없습니다.',
    ] },
    { q: '민팅 가격은 얼마인가요?', a: [
      '민팅 가격은 추후 공개됩니다. 민팅이 열리기 전에 GIWA COWS 공식 X와 이 페이지에 게시됩니다.',
      '민팅할 때 지갑은 확인 전에 항상 정확한 가격을 보여주며, 컨트랙트는 정확한 금액만 받습니다.',
    ] },
    { q: '민팅은 언제인가요?', a: [
      '민팅 일정은 GIWA 메인넷 출시 즈음에 공개됩니다. 놓치지 않도록 공식 X를 팔로우하고 알림을 켜두세요.',
    ] },
    { q: '허용 목록(Allowlist)은 어떻게 받나요?', a: [
      '허용 목록 배포는 테스트넷 단계인 1단계에서 시작됩니다. 자리를 배분하는 방식은 라운드마다 GIWA COWS 공식 소셜에서 안내합니다.',
      '허용 목록은 DM으로 판매되지 않습니다. 자리를 위해 돈을 요구하거나 "받기" 위해 서명을 요청하는 사람은 사기꾼입니다.',
    ] },
    { q: '홀더는 어떤 유틸리티를 받나요?', a: [
      '유틸리티는 곧 공개됩니다. 로드맵 3단계에서 NFT 유틸리티, $STABLE 토큰, 활용 사례, DEX 기능이 도입됩니다. 모든 내용은 공식 X에서 먼저 발표됩니다.',
    ] },
    { q: '어떤 네트워크와 지갑이 필요한가요?', a: [
      'GIWA COWS는 Upbit의 이더리움 레이어 2인 GIWA에 있습니다. MetaMask, Rabby, OKX Wallet 등 모든 EVM 지갑을 사용할 수 있으며, 연결하면 STABLE이 GIWA 네트워크를 지갑에 추가합니다.',
    ] },
    { q: '진짜 GIWA COWS를 민팅하는지 어떻게 알 수 있나요?', a: [
      'stablemarket.art/giwa-cows에서만 민팅하세요. 공식 컬렉션에는 금색 체크가 표시되며, 컨트랙트 주소는 민팅 전에 이 페이지와 공식 X에 게시됩니다.',
      '저희는 절대 DM으로 민팅 링크를 보내지 않으며 시드 문구를 요구하지 않습니다.',
    ] },
    { q: '민팅 후에는 어디서 거래하나요?', a: [
      '바로 이곳 StableMarket에서 거래합니다. 민팅이 시작되는 순간부터 리스팅, 구매, 바닥가 스윕, 개별 소 또는 컬렉션 전체에 대한 오퍼가 가능합니다.',
    ] },
  ],
  joinTitle: '소 떼에 합류하세요',
  joinBody: '허용 목록 라운드, 민팅 일정, 유틸리티 공개 소식은 공식 X에서 가장 먼저 전해집니다.',
  nav: { overview: '개요', market: '마켓', utility: '유틸리티', arts: '아트', roadmap: '로드맵', faq: 'FAQ' },
  ticker: ['GIWA COWS', '발행량 3,333', '공식 컬렉션', '민팅 가격 TBA', '메인넷 즈음 민팅', 'GIWA 기반'],
};

export const cowsContent = (lang: Lang): CowsContent => (lang === 'ko' ? KO : EN);
