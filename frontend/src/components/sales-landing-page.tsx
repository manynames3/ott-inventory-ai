import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  Boxes,
  Cloud,
  Database,
  FileSpreadsheet,
  LockKeyhole,
  MessageSquareText,
  PackageCheck,
  Server,
  ShieldCheck
} from "lucide-react";

const workflowSteps = [
  {
    code: "products.csv + lots.csv",
    copy: "라면, 즉석밥, 소스, 유지류, 냉동만두, 카레, HMR까지 품질 기준에 필요한 SKU·유통기한·로트·창고·원가 정보를 한 번에 정리합니다.",
    number: "01",
    title: "제품과 로트 기준을 맞춥니다"
  },
  {
    code: "orders.csv + inbound.csv",
    copy: "2년치 주문 흐름, 입고 예정 물량, 해상 운송 리드타임, 미국 내 창고 재고를 함께 보며 결품과 장기 체류를 미리 감지합니다.",
    number: "02",
    title: "수요와 공급 흐름을 봅니다"
  },
  {
    code: "POST /api/query",
    copy: "품절 위험, 임박 유통기한, FEFO 출고 우선순위, 이번 주 발주 품목을 자연어로 묻고 바로 확인합니다.",
    number: "03",
    title: "현장 질문에 답합니다"
  },
  {
    code: "roi-report.html",
    copy: "폐기 절감 기회, 결품 노출, 권장 발주, 판단 신뢰도를 리더십이 바로 볼 수 있는 보고서로 남깁니다.",
    number: "04",
    title: "오늘의 실행 근거를 남깁니다"
  }
];

const platformItems = [
  {
    copy: "Cloudflare Pages로 UI를 제공해, 파일럿 단계에서 상시 프론트엔드 서버 비용을 만들지 않습니다.",
    icon: <Cloud size={18} />,
    title: "정적 프론트엔드"
  },
  {
    copy: "AWS Lambda가 API, 파일 가져오기, 추천 갱신 작업을 필요할 때만 실행합니다.",
    icon: <Server size={18} />,
    title: "서버리스 백엔드"
  },
  {
    copy: "S3는 원본 업로드를 보관하고, DynamoDB는 빠른 대시보드와 질의 결과 뷰를 제공합니다.",
    icon: <Database size={18} />,
    title: "저비용 저장 구조"
  },
  {
    copy: "ECS Fargate, NAT Gateway, RDS, OpenSearch처럼 고정비가 큰 구성을 파일럿 단계에서 피합니다.",
    icon: <BadgeDollarSign size={18} />,
    title: "비용 우선 설계"
  },
  {
    copy: "Terraform으로 권한, CORS, 업로드 버킷, Lambda URL, 갱신 워커를 반복 가능하게 관리합니다.",
    icon: <Boxes size={18} />,
    title: "Terraform 기반"
  },
  {
    copy: "로그인, 비공개 업로드, 가져오기 이력, 하드코딩 없는 비밀값 관리로 구매자 검토에 필요한 기본 신뢰를 갖춥니다.",
    icon: <LockKeyhole size={18} />,
    title: "파일럿 보안 스토리"
  }
];

const plans = [
  {
    copy: "오뚜기 아메리카 첫 미팅용. 데모 데이터와 고객 제공 파일 1세트로 가치를 빠르게 확인합니다.",
    features: ["호스팅된 파일럿 앱", "CSV 템플릿", "임원용 ROI 리포트", "가져오기 검증 이력"],
    name: "검증 파일럿"
  },
  {
    copy: "공급망 팀이 반복 갱신, 플래너 검토, 영업 후속 조치 큐까지 확인하는 운영 파일럿입니다.",
    featured: true,
    features: ["일일 갱신 워커", "우선 실행 큐", "자연어 질의 뷰", "구매자 맞춤 대시보드 문구"],
    name: "운영 파일럿"
  },
  {
    copy: "고객 소유 AWS 계정, 조달 검토, 또는 프라이빗 배포가 필요한 단계의 패키지입니다.",
    features: ["Terraform 패키지", "고객 AWS 계정 배포 경로", "ERP 어댑터 자리", "보안 검토 지원"],
    name: "프라이빗 AWS"
  }
];

const queryRows = [
  'curl -sS "$STOCKSENSE_API/api/query" \\',
  '  -H "authorization: Bearer $TOKEN" \\',
  '  -H "content-type: application/json" \\',
  "  -d '{",
  '    "question": "향후 30일 안에 품절 위험이 있는 SKU는?"',
  "  }'",
  "",
  "{",
  '  "action_summary": [',
  '    "지금 조치가 필요한 SKU/창고 조합이 25개입니다.",',
  '    "최우선: LA DC의 OTG-CUR-001, 가용 재고 13.5일."',
  "  ]",
  "}"
];

function StockSenseBrand() {
  return (
    <span className="sales-ref-brand-lockup">
      <img
        className="sales-ref-brand-logo"
        src="/assets/stocksense-ottogi-logo.svg"
        alt=""
        aria-hidden="true"
      />
      <span className="sales-ref-brand-type">
        <strong>StockSense AI</strong>
        <small>오뚜기 운영 파일럿</small>
      </span>
    </span>
  );
}

export function SalesLandingPage() {
  return (
    <div className="sales-page sales-reference" lang="ko">
      <header className="sales-ref-header">
        <Link href="/sales" className="sales-ref-brand" aria-label="StockSense AI sales page">
          <StockSenseBrand />
        </Link>
        <nav className="sales-ref-nav" aria-label="세일즈 페이지 내비게이션">
          <a href="#workflow">진행 방식</a>
          <a href="#platform">플랫폼</a>
          <a href="#plans">파일럿 구성</a>
          <Link href="/imports">앱 보기</Link>
        </nav>
        <Link href="/login" className="sales-ref-cta">
          파일럿 열기
        </Link>
      </header>

      <main id="top">
        <section className="sales-ref-hero" aria-labelledby="sales-hero-title">
          <img
            className="sales-ref-hero-visual"
            src="/assets/stocksense-platform-preview-dark.svg"
            alt="오뚜기형 가져오기 검증, 품절 위험, FEFO 로트 우선순위, 자연어 질의 결과를 보여주는 StockSense AI 플랫폼 미리보기"
          />
          <div className="sales-ref-hero-overlay" />
          <div className="sales-ref-hero-content">
            <h1 id="sales-hero-title">
              맛과 품질을 가장 소중히 생각하는 재고 AI.
            </h1>
            <p className="sales-ref-hero-copy">
              라면, 즉석밥, 소스, 유지류, 냉동, HMR처럼 신선도와 회전율이 함께 중요한 품목을 위해
              FEFO 출고, 식품안전 관점의 유통기한 리스크, 결품 위험, 발주 시점을 한 화면에서 설명합니다.
              ERP 전면 통합 전에도 기존 파일만으로 북미 파일럿을 시작할 수 있습니다.
            </p>
            <div className="sales-ref-actions">
              <Link href="/login" className="sales-ref-button primary">
                파일럿 앱 열기
                <ArrowRight size={17} />
              </Link>
              <a href="#workflow" className="sales-ref-button secondary">
                진행 방식 보기
              </a>
            </div>
            <dl className="sales-ref-stats">
              <div>
                <dt>품질</dt>
                <dd>FEFO 로트 출고 원칙</dd>
              </div>
              <div>
                <dt>$428K</dt>
                <dd>데모 기준 폐기 절감 기회</dd>
              </div>
              <div>
                <dt>북미 파일럿</dt>
                <dd>ERP 연동 전 가치 검증</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="sales-ref-lineage sales-ref-section-pad">
          <div className="sales-ref-inner sales-ref-two-column">
            <div>
              <h2>신선한 원료와 안전한 품질이 물류 끝단까지 이어지도록.</h2>
            </div>
            <p>
              오뚜기가 말하는 맛과 품질, 식품안전문화, 소비자에게 편리한 제품은 생산 이후의 운영에서도
              이어져야 합니다. StockSense AI는 어떤 로트를 먼저 출고할지, 어떤 SKU가 결품 위험인지,
              어떤 입고 예정 물량이 판단을 바꾸는지, 어떤 장기 체류 재고를 이전·프로모션·할인해야 하는지까지
              일일 실행 큐로 바꿉니다.
            </p>
          </div>
        </section>

        <section className="sales-ref-section-pad sales-ref-muted-band" id="workflow">
          <div className="sales-ref-inner">
            <div className="sales-ref-section-heading">
              <h2>가볍게 시작해, 당일 판단까지.</h2>
              <p>
                ERP 실시간 연동 전에 먼저 가치를 증명합니다. CSV를 첫 어댑터로 사용하고, SAP·Oracle 연동
                자리는 다음 단계까지 열어두어 파일럿 이후의 확장성을 함께 봅니다.
              </p>
            </div>
            <div className="sales-ref-steps">
              {workflowSteps.map((step) => (
                <article className="sales-ref-step" key={step.number}>
                  <span className="sales-ref-step-number">{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                  <code>{step.code}</code>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sales-ref-section-pad" id="code">
          <div className="sales-ref-inner sales-ref-code-layout">
            <div className="sales-ref-code-copy">
              <h2>운영팀이 묻는 말 그대로, 실행 가능한 답을 돌려줍니다.</h2>
              <p>
                “30일 안에 품절될 SKU는?”, “이번 주 무엇을 발주해야 하나?”, “곧 만료되는 로트는?” 같은 질문에
                요약 답변과 표를 함께 제공합니다.
              </p>
              <ul className="sales-ref-feature-list">
                <li>임의 SQL이 아닌 안전한 규칙 기반 질의 템플릿을 사용합니다.</li>
                <li>SKU명, 카테고리, 금액, 권장 액션, 판단 신뢰도를 함께 보여줍니다.</li>
                <li>업로드와 갱신 작업 후 빠르게 읽을 수 있도록 뷰를 미리 계산합니다.</li>
              </ul>
            </div>
            <div className="sales-ref-code-panel">
              <div className="sales-ref-tabs" role="tablist" aria-label="질의 예시">
                <span aria-selected="true">질의</span>
                <span>결과</span>
                <span>보고서</span>
              </div>
              <pre className="sales-ref-code-block">{queryRows.join("\n")}</pre>
            </div>
          </div>
        </section>

        <section className="sales-ref-section-pad sales-ref-muted-band" id="platform">
          <div className="sales-ref-inner">
            <div className="sales-ref-section-heading">
              <h2>고정비를 키우지 않고, 구매 검토에 필요한 신뢰를 먼저 만듭니다.</h2>
              <p>
                대규모 통합 프로젝트 전에 의사결정 가치를 보여주는 구조입니다. 트래픽이 낮은 파일럿 기간에도
                높은 월 고정 인프라 비용을 만들지 않도록 설계했습니다.
              </p>
            </div>
            <div className="sales-ref-platform-grid">
              {platformItems.map((item) => (
                <article className="sales-ref-platform-item" key={item.title}>
                  <span>{item.icon}</span>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sales-ref-section-pad" id="plans">
          <div className="sales-ref-inner">
            <div className="sales-ref-section-heading">
              <h2>글로벌 식품 기업의 운영팀이 바로 평가할 수 있는 파일럿.</h2>
              <p>
                핵심은 단순합니다. 폐기 가능 금액, 결품 노출, 플래너 시간 절감이 실제 품목군에서 보이는지
                확인합니다. 그 다음 같은 흐름을 반복 호스팅 또는 프라이빗 AWS 배포로 확장합니다.
              </p>
            </div>
            <div className="sales-ref-plans">
              {plans.map((plan) => (
                <article className={plan.featured ? "sales-ref-plan featured" : "sales-ref-plan"} key={plan.name}>
                  <h3>{plan.name}</h3>
                  <p className="sales-ref-plan-for">{plan.copy}</p>
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sales-ref-cta-band">
          <div className="sales-ref-inner sales-ref-cta-content">
            <div>
              <h2>보여줄 것은 또 하나의 스프레드시트가 아니라, 오늘 지켜야 할 품질과 매출입니다.</h2>
              <p>
                파일럿의 목표는 명확합니다. 보호 가능한 폐기 금액, 리드타임 전에 보이는 결품 리스크, 그리고
                지금 먼저 배정해야 할 라면·밥·소스·유지류·냉동·HMR 로트를 보여주는 것입니다.
              </p>
            </div>
            <div className="sales-ref-cta-actions">
              <Link href="/login" className="sales-ref-button primary">
                파일럿 시작
                <ArrowRight size={17} />
              </Link>
              <Link href="/imports" className="sales-ref-button secondary on-dark">
                가져오기 화면 보기
              </Link>
            </div>
          </div>
        </section>

        <section className="sales-ref-section-pad" id="faq">
          <div className="sales-ref-inner sales-ref-faq">
            <div>
              <ShieldCheck size={22} />
              <h3>ERP를 대체하나요?</h3>
              <p>아닙니다. ERP는 기준 시스템으로 유지하고, StockSense AI는 예외 탐지와 판단 설명 레이어가 됩니다.</p>
            </div>
            <div>
              <FileSpreadsheet size={22} />
              <h3>어떤 파일이 필요하나요?</h3>
              <p>제품, 재고 로트, 고객, 주문, 입고 예정 파일이면 MVP 검증에 충분합니다.</p>
            </div>
            <div>
              <MessageSquareText size={22} />
              <h3>무엇을 물어볼 수 있나요?</h3>
              <p>품절 위험, 만료 임박 재고, 발주 액션, FEFO 우선순위, 고객 구매 주기까지 물어볼 수 있습니다.</p>
            </div>
            <div>
              <PackageCheck size={22} />
              <h3>ROI는 무엇으로 증명하나요?</h3>
              <p>폐기 금액 보호, 결품 예외 조기 발견, 플래너 수작업 시간 감소로 증명합니다.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="sales-ref-footer">
        <span>©2026 SUPREME AI VENTURES LLC</span>
        <span>오뚜기형 식품 운영을 위한 유통기한 인텔리전스.</span>
      </footer>
    </div>
  );
}
