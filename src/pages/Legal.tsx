// Terms of Use and Privacy Policy (English and Korean). Written for how STABLE actually works; have them
// reviewed for your jurisdiction before mainnet.
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { BRAND } from '../config';
import { BackButton } from '../components/BackButton';

type Section = { h: string; p: string[] };
type Doc = { title: string; intro: string; sections: Section[] };
const UPDATED = '2026-09-25';

const TERMS: Record<'en' | 'ko', Doc> = {
  en: {
    title: 'Terms of Use',
    intro: `These terms apply when you use ${BRAND.name} (the website, launchpad and marketplace). By connecting a wallet or using the site you agree to them. If you do not agree, please do not use ${BRAND.name}.`,
    sections: [
      { h: '1. What STABLE is', p: [`${BRAND.name} is an interface to smart contracts on the GIWA network. It lets creators launch NFT collections and lets anyone mint, list, buy, sell and make offers on NFTs.`, `${BRAND.name} never holds your NFTs or funds. Every trade and mint happens directly between wallets and the smart contracts.`] },
      { h: '2. Testnet', p: ['While the site runs on GIWA Sepolia (a test network), all tokens and NFTs are for testing and have no monetary value. Test data may be reset.'] },
      { h: '3. Your wallet', p: ['You are responsible for your wallet, its keys and every transaction you approve. We will never ask for your seed phrase or private key. Blockchain transactions cannot be reversed.', 'You must be at least 18 years old and allowed to use these services where you live.'] },
      { h: '4. Fees', p: ['A marketplace fee is taken from each sale, a platform fee from each mint, and creators may receive a royalty on resales. Every fee is shown before you confirm, and network (gas) fees are paid to the network, not to us.'] },
      { h: '5. Creators', p: ['If you launch a collection, you confirm that you own or have the rights to its artwork and content, that the information you provide is accurate, and that you will honour what you promise to collectors.', 'Mint settings (prices, times, wallet limits, allowlists) are enforced by your collection contract. Changes made after minting starts are shown publicly on the mint page.'] },
      { h: '6. Not allowed', p: ['Fraud, impersonation, wash trading or other market manipulation, stolen or infringing content, malware, content that harms minors, and use that breaks sanctions or other laws.'] },
      { h: '7. Moderation', p: ['We may hide, delist or stop trading of collections or items on the site, or restrict accounts, to protect users or comply with law. This does not change anything on the blockchain.'] },
      { h: '8. Risks', p: ['NFT prices can change quickly and may go to zero. Smart contracts can have bugs even after testing. Networks can be congested or unavailable. You use the service at your own risk.'] },
      { h: '9. No advice, no warranty', p: [`Nothing on ${BRAND.name} is financial, legal or tax advice. The service is provided "as is" without warranties of any kind.`] },
      { h: '10. Limitation of liability', p: ['To the maximum extent allowed by law, we are not liable for indirect or consequential losses, lost profits, or losses caused by wallets, networks, smart contracts or third parties.'] },
      { h: '11. Changes', p: ['We may update these terms. The date at the top shows the latest version; continuing to use the site means you accept the update.'] },
      { h: '12. Contact', p: ['Questions or reports: use the Support page.'] },
    ],
  },
  ko: {
    title: '이용약관',
    intro: `본 약관은 ${BRAND.name}(웹사이트, 런치패드, 마켓플레이스)을 이용할 때 적용됩니다. 지갑을 연결하거나 사이트를 이용하면 본 약관에 동의한 것으로 봅니다. 동의하지 않으시면 이용하지 마세요.`,
    sections: [
      { h: '1. STABLE 소개', p: [`${BRAND.name}은 GIWA 네트워크의 스마트 컨트랙트를 이용하는 인터페이스입니다. 크리에이터는 NFT 컬렉션을 출시할 수 있고, 누구나 NFT를 민팅, 판매 등록, 구매, 판매하고 제안할 수 있습니다.`, `${BRAND.name}은 여러분의 NFT나 자금을 보관하지 않습니다. 모든 거래와 민팅은 지갑과 스마트 컨트랙트 사이에서 직접 이루어집니다.`] },
      { h: '2. 테스트넷', p: ['사이트가 GIWA Sepolia(테스트 네트워크)에서 운영되는 동안 모든 토큰과 NFT는 테스트용이며 금전적 가치가 없습니다. 테스트 데이터는 초기화될 수 있습니다.'] },
      { h: '3. 지갑', p: ['지갑과 키, 그리고 승인하는 모든 트랜잭션에 대한 책임은 본인에게 있습니다. 저희는 시드 문구나 개인 키를 절대 요청하지 않습니다. 블록체인 트랜잭션은 되돌릴 수 없습니다.', '만 18세 이상이어야 하며, 거주 지역에서 본 서비스를 이용할 수 있어야 합니다.'] },
      { h: '4. 수수료', p: ['판매 시 마켓플레이스 수수료, 민팅 시 플랫폼 수수료가 부과되며, 크리에이터는 재판매 시 로열티를 받을 수 있습니다. 모든 수수료는 확인 전에 표시되며, 네트워크(가스) 수수료는 저희가 아닌 네트워크에 지불됩니다.'] },
      { h: '5. 크리에이터', p: ['컬렉션을 출시하는 경우, 아트워크와 콘텐츠에 대한 권리를 보유하고 있으며 제공하는 정보가 정확하고 컬렉터에게 약속한 내용을 지킬 것을 확인합니다.', '민팅 설정(가격, 시간, 지갑당 한도, 허용 목록)은 컬렉션 컨트랙트가 적용합니다. 민팅 시작 후의 변경 사항은 민팅 페이지에 공개됩니다.'] },
      { h: '6. 금지 행위', p: ['사기, 사칭, 자전거래 등 시장 조작, 도용되었거나 권리를 침해하는 콘텐츠, 악성코드, 미성년자에게 해를 끼치는 콘텐츠, 제재 또는 기타 법률을 위반하는 이용.'] },
      { h: '7. 운영 조치', p: ['이용자 보호나 법률 준수를 위해 사이트에서 컬렉션이나 아이템을 숨기거나 거래를 중단하고, 계정을 제한할 수 있습니다. 이는 블록체인의 내용을 바꾸지 않습니다.'] },
      { h: '8. 위험', p: ['NFT 가격은 빠르게 변할 수 있으며 0이 될 수도 있습니다. 스마트 컨트랙트는 테스트 후에도 오류가 있을 수 있고, 네트워크가 혼잡하거나 이용 불가할 수 있습니다. 서비스 이용에 따른 위험은 본인이 부담합니다.'] },
      { h: '9. 조언 아님, 보증 없음', p: [`${BRAND.name}의 어떤 내용도 투자, 법률, 세무 조언이 아닙니다. 서비스는 어떠한 보증 없이 "있는 그대로" 제공됩니다.`] },
      { h: '10. 책임의 제한', p: ['법이 허용하는 최대 범위에서, 간접적·결과적 손해, 이익 손실, 지갑·네트워크·스마트 컨트랙트·제3자로 인한 손해에 대해 책임지지 않습니다.'] },
      { h: '11. 변경', p: ['본 약관은 변경될 수 있습니다. 상단의 날짜가 최신 버전을 나타내며, 계속 이용하면 변경에 동의한 것으로 봅니다.'] },
      { h: '12. 문의', p: ['문의나 신고는 고객 지원 페이지를 이용하세요.'] },
    ],
  },
};

const PRIVACY: Record<'en' | 'ko', Doc> = {
  en: {
    title: 'Privacy Policy',
    intro: `This policy explains what ${BRAND.name} collects, why, and what your choices are. We collect as little as possible.`,
    sections: [
      { h: '1. What we collect', p: ['Your public wallet address and on-chain activity (mints, listings, sales, offers), which are public on the blockchain anyway.', 'A signed sign-in message to confirm you control your wallet. It costs nothing and cannot move funds.', 'Profile details you choose to add, and support tickets you send. Contact details in tickets are stored encrypted.', 'Basic technical data such as IP address and request logs, used for security and rate limiting and kept only briefly.'] },
      { h: '2. What we never collect', p: ['Private keys or seed phrases, payment card details, or advertising trackers.'] },
      { h: '3. How we use it', p: ['To show collections, items, prices and activity; to let you sign in and manage your collections; to answer support requests; and to keep the service secure.'] },
      { h: '4. The blockchain is public', p: ['Transactions on GIWA are permanent and visible to anyone. We cannot change or delete them.'] },
      { h: '5. Service providers', p: ['We use hosting, database, blockchain RPC and IPFS providers to run the service. Your browser loads the live ETH price from public price services (CoinGecko or Binance), and wallet apps you connect have their own policies.'] },
      { h: '6. Stored in your browser', p: ['Your theme, language, currency choice and which wallet you connected are saved in your browser so the site remembers them. You can clear them at any time.'] },
      { h: '7. Retention', p: ['Marketplace data follows the blockchain. Support tickets are kept while needed to help you. Security logs are kept only briefly.'] },
      { h: '8. Security', p: ['Connections are encrypted (HTTPS), the database is private and locked down, and sensitive fields are encrypted at rest.'] },
      { h: '9. Your choices', p: ['You can edit your profile, disconnect your wallet at any time, and ask us through Support to delete your profile details or tickets.'] },
      { h: '10. Age', p: [`${BRAND.name} is not intended for anyone under 18.`] },
      { h: '11. Changes and contact', p: ['We may update this policy; the date at the top shows the latest version. Questions: use the Support page.'] },
    ],
  },
  ko: {
    title: '개인정보처리방침',
    intro: `본 방침은 ${BRAND.name}이 무엇을, 왜 수집하며 이용자가 어떤 선택을 할 수 있는지 설명합니다. 저희는 가능한 한 최소한의 정보만 수집합니다.`,
    sections: [
      { h: '1. 수집하는 정보', p: ['공개 지갑 주소와 온체인 활동(민팅, 판매 등록, 판매, 제안). 이 정보는 블록체인에 이미 공개되어 있습니다.', '지갑 소유를 확인하기 위한 서명 로그인 메시지. 비용이 들지 않으며 자금을 이동할 수 없습니다.', '직접 추가한 프로필 정보와 보낸 고객 지원 문의. 문의의 연락처 정보는 암호화되어 저장됩니다.', 'IP 주소, 요청 기록 등 보안과 요청 제한을 위한 기본 기술 정보. 짧은 기간만 보관합니다.'] },
      { h: '2. 수집하지 않는 정보', p: ['개인 키나 시드 문구, 결제 카드 정보, 광고 추적 정보.'] },
      { h: '3. 이용 목적', p: ['컬렉션, 아이템, 가격, 활동을 보여주고, 로그인과 컬렉션 관리를 지원하며, 고객 문의에 답변하고, 서비스를 안전하게 유지하기 위해 사용합니다.'] },
      { h: '4. 블록체인은 공개됩니다', p: ['GIWA의 트랜잭션은 영구적이며 누구나 볼 수 있습니다. 저희는 이를 변경하거나 삭제할 수 없습니다.'] },
      { h: '5. 서비스 제공자', p: ['서비스 운영을 위해 호스팅, 데이터베이스, 블록체인 RPC, IPFS 제공자를 이용합니다. 브라우저는 공개 시세 서비스(CoinGecko 또는 Binance)에서 실시간 ETH 가격을 불러오며, 연결하는 지갑 앱에는 각자의 방침이 적용됩니다.'] },
      { h: '6. 브라우저에 저장되는 정보', p: ['테마, 언어, 통화 선택, 연결한 지갑 정보가 브라우저에 저장되어 사이트가 기억합니다. 언제든지 삭제할 수 있습니다.'] },
      { h: '7. 보관 기간', p: ['마켓플레이스 데이터는 블록체인을 따릅니다. 고객 문의는 지원에 필요한 기간 동안 보관하며, 보안 기록은 짧은 기간만 보관합니다.'] },
      { h: '8. 보안', p: ['모든 연결은 암호화(HTTPS)되며, 데이터베이스는 비공개로 보호되고 민감한 항목은 암호화되어 저장됩니다.'] },
      { h: '9. 이용자의 선택', p: ['프로필을 수정하고 언제든지 지갑 연결을 해제할 수 있으며, 고객 지원을 통해 프로필 정보나 문의 삭제를 요청할 수 있습니다.'] },
      { h: '10. 연령', p: [`${BRAND.name}은 만 18세 미만을 대상으로 하지 않습니다.`] },
      { h: '11. 변경 및 문의', p: ['본 방침은 변경될 수 있으며, 상단의 날짜가 최신 버전을 나타냅니다. 문의는 고객 지원 페이지를 이용하세요.'] },
    ],
  },
};

export default function Legal({ kind }: { kind: 'terms' | 'privacy' }) {
  const { t, lang } = useI18n();
  const doc = (kind === 'terms' ? TERMS : PRIVACY)[lang === 'ko' ? 'ko' : 'en'];
  return (
    <div className="page container legal">
      <div className="back-row"><BackButton /></div>
      <header className="legal__head">
        <span className="pill pill--outline">{t('legal.updated', { date: UPDATED })}</span>
        <h1 className="h1">{doc.title}</h1>
        <p className="lead">{doc.intro}</p>
      </header>
      <div className="legal__layout">
        <nav className="legal__toc" aria-label={doc.title}>
          {doc.sections.map((s, i) => <a key={s.h} href={`#s${i + 1}`}>{s.h}</a>)}
        </nav>
        <article className="legal__body">
          {doc.sections.map((s, i) => (
            <section key={s.h} id={`s${i + 1}`}>
              <h2 className="h3">{s.h}</h2>
              {s.p.map((x) => <p key={x.slice(0, 40)} className="soft">{x}</p>)}
            </section>
          ))}
          <div className="row-wrap" style={{ marginTop: 18 }}>
            <Link className="btn btn--outline btn--sm" to={kind === 'terms' ? '/privacy' : '/terms'}>{kind === 'terms' ? t('legal.privacy') : t('legal.terms')}</Link>
            <Link className="btn btn--sm" to="/support">{t('nav.support')}</Link>
          </div>
        </article>
      </div>
    </div>
  );
}
