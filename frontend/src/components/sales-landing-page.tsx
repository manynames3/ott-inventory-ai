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
    copy: "Load OTOKI-style SKUs across ramen, cooked rice, frozen mandu, sauces, sesame oil, curry, and ready meals.",
    number: "01",
    title: "Import product and lot data"
  },
  {
    code: "orders.csv + inbound.csv",
    copy: "Blend two years of customer demand with open inbound shipments, lead time, and US warehouse inventory.",
    number: "02",
    title: "Refresh demand and supply risk"
  },
  {
    code: "POST /api/query",
    copy: "Ask natural questions about stockouts, expiring lots, reorder timing, FEFO picks, and customer cadence.",
    number: "03",
    title: "Ask Inventory AI"
  },
  {
    code: "roi-report.html",
    copy: "Export a leadership-ready readout with waste dollars, fill-rate exposure, recommended buys, and confidence notes.",
    number: "04",
    title: "Defend the action"
  }
];

const platformItems = [
  {
    copy: "Cloudflare Pages serves the product UI with no always-on frontend host for a low-friction evaluation.",
    icon: <Cloud size={18} />,
    title: "Static frontend"
  },
  {
    copy: "AWS Lambda runs the API, import worker, and refresh jobs only when planners upload or query data.",
    icon: <Server size={18} />,
    title: "Serverless backend"
  },
  {
    copy: "S3 stores raw imports, while DynamoDB stores fast materialized dashboard and query views.",
    icon: <Database size={18} />,
    title: "Low-idle storage"
  },
  {
    copy: "The pilot avoids ECS Fargate, NAT Gateway, RDS, OpenSearch, and fixed compute minimums.",
    icon: <BadgeDollarSign size={18} />,
    title: "Cost-first shape"
  },
  {
    copy: "Terraform manages AWS resources, permissions, CORS, import buckets, Lambda URLs, and refresh workers.",
    icon: <Boxes size={18} />,
    title: "Terraform managed"
  },
  {
    copy: "Login, private uploads, import audit history, and no hardcoded credentials keep the demo credible for buyer review.",
    icon: <LockKeyhole size={18} />,
    title: "Pilot security story"
  }
];

const plans = [
  {
    copy: "For a first OTOKI America walkthrough using the demo set and one customer-provided export.",
    features: ["Hosted pilot app", "CSV templates", "Executive ROI report", "Import validation history"],
    name: "Evaluation Pilot"
  },
  {
    copy: "For a supply chain team that wants recurring refreshes, planner review, and sales follow-up queues.",
    featured: true,
    features: ["Daily refresh worker", "Priority action queue", "Natural-language query views", "Buyer-specific dashboard copy"],
    name: "Ops Pilot"
  },
  {
    copy: "For teams that need customer-owned infrastructure, procurement review, or private AWS deployment.",
    features: ["Terraform package", "Customer AWS account path", "ERP adapter placeholders", "Security review support"],
    name: "Private AWS"
  }
];

const queryRows = [
  'curl -sS "$INVENTORY_AI_API/api/query" \\',
  '  -H "authorization: Bearer $TOKEN" \\',
  '  -H "content-type: application/json" \\',
  "  -d '{",
  '    "question": "Which SKUs will stock out in the next 30 days?"',
  "  }'",
  "",
  "{",
  '  "action_summary": [',
  '    "25 SKU/warehouse combinations need action now.",',
  '    "Highest priority: OTG-CUR-001 in LA DC with 13.5 days of supply."',
  "  ]",
  "}"
];

export function SalesLandingPage() {
  return (
    <div className="sales-page sales-reference">
      <header className="sales-ref-header">
        <Link href="/sales" className="sales-ref-brand" aria-label="Inventory AI sales page">
          <span aria-hidden="true">IA</span>
          <strong>Inventory AI</strong>
        </Link>
        <nav className="sales-ref-nav" aria-label="Sales page navigation">
          <a href="#workflow">Workflow</a>
          <a href="#platform">Platform</a>
          <a href="#plans">Plans</a>
          <Link href="/imports">App</Link>
        </nav>
        <Link href="/login" className="sales-ref-cta">
          Open pilot
        </Link>
      </header>

      <main id="top">
        <section className="sales-ref-hero" aria-labelledby="sales-hero-title">
          <img
            className="sales-ref-hero-visual"
            src="/assets/inventory-ai-platform-preview-dark.svg"
            alt="Inventory AI platform preview showing import validation, reorder risk, FEFO lots, and natural language query output"
          />
          <div className="sales-ref-hero-overlay" />
          <div className="sales-ref-hero-content">
            <p className="sales-ref-eyebrow">Built for an OTOKI North America pilot</p>
            <h1 id="sales-hero-title">
              Protect OTOKI quality from expiry and stockout risk.
            </h1>
            <p className="sales-ref-hero-copy">
              A hosted decision layer for ramen, rice, sauce, oil, frozen, and ready-meal inventory that needs FEFO
              recommendations, stockout prevention, reorder explanations, and waste-dollar visibility without waiting
              on a full ERP project.
            </p>
            <div className="sales-ref-actions">
              <Link href="/login" className="sales-ref-button primary">
                Open pilot app
                <ArrowRight size={17} />
              </Link>
              <a href="#workflow" className="sales-ref-button secondary">
                See workflow
              </a>
            </div>
            <dl className="sales-ref-stats">
              <div>
                <dt>Quality</dt>
                <dd>FEFO lot discipline</dd>
              </div>
              <div>
                <dt>$428K</dt>
                <dd>demo waste opportunity</dd>
              </div>
              <div>
                <dt>US pilot</dt>
                <dd>Norwalk-style distribution flow</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="sales-ref-lineage sales-ref-section-pad">
          <div className="sales-ref-inner sales-ref-two-column">
            <div>
              <p className="sales-ref-section-kicker">From quality promise to execution layer</p>
              <h2>When the product promise is taste and quality, expiry risk cannot stay buried.</h2>
            </div>
            <p>
              OTOKI emphasizes superior quality, hygienic production, fresh ingredients, and global customer needs.
              Inventory AI translates that operating standard into a daily exception layer: which lot ships first,
              which SKU risks stockout, which inbound container changes the decision, and which aging inventory needs
              transfer, promotion, or discount action.
            </p>
          </div>
        </section>

        <section className="sales-ref-section-pad sales-ref-muted-band" id="workflow">
          <div className="sales-ref-inner">
            <div className="sales-ref-section-heading">
              <p className="sales-ref-section-kicker">Pilot workflow</p>
              <h2>Four steps from spreadsheet exports to a ranked operating decision.</h2>
              <p>
                The MVP is built to prove value before live ERP integration. CSV is the first adapter; SAP and Oracle
                placeholders keep the architecture ready for the next stage when OTOKI wants live connectivity.
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
              <p className="sales-ref-section-kicker">Natural-language query</p>
              <h2>A straightforward answer surface for OTOKI planners and operators.</h2>
              <p>
                Users can ask what will stock out, what expires soon, which customers usually buy a SKU every month,
                and what to reorder this week. The response includes a concise action summary and a structured table.
              </p>
              <ul className="sales-ref-feature-list">
                <li>Rule-based query templates avoid unsafe arbitrary SQL.</li>
                <li>Rows include SKU names, categories, values, actions, and confidence notes.</li>
                <li>Views are materialized for fast reads after import and refresh jobs.</li>
              </ul>
            </div>
            <div className="sales-ref-code-panel">
              <div className="sales-ref-tabs" role="tablist" aria-label="Query examples">
                <span aria-selected="true">Query</span>
                <span>Result</span>
                <span>Report</span>
              </div>
              <pre className="sales-ref-code-block">{queryRows.join("\n")}</pre>
            </div>
          </div>
        </section>

        <section className="sales-ref-section-pad sales-ref-muted-band" id="platform">
          <div className="sales-ref-inner">
            <div className="sales-ref-section-heading">
              <p className="sales-ref-section-kicker">AWS-native platform</p>
              <h2>Built for low idle cost and buyer-safe OTOKI evaluation.</h2>
              <p>
                The current architecture keeps the MVP credible for a real evaluation without forcing a high fixed
                monthly platform bill or a long integration project before value is visible.
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
              <p className="sales-ref-section-kicker">Packaging</p>
              <h2>A concrete pilot package for the first OTOKI conversation.</h2>
              <p>
                The sales motion is simple: prove waste dollars, fill-rate exposure, and planner time saved on the
                product families OTOKI already moves through North America. Then package the same workflow as a
                recurring hosted or private AWS deployment.
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
              <h2>Show OTOKI the answer, not another spreadsheet.</h2>
              <p>
                Use the pilot to show recoverable waste value, stockout risk before the freight window closes, and
                the specific ramen, rice, sauce, oil, frozen, and ready-meal lots planners should allocate first.
              </p>
            </div>
            <div className="sales-ref-cta-actions">
              <Link href="/login" className="sales-ref-button primary">
                Launch pilot
                <ArrowRight size={17} />
              </Link>
              <Link href="/imports" className="sales-ref-button secondary on-dark">
                View imports
              </Link>
            </div>
          </div>
        </section>

        <section className="sales-ref-section-pad" id="faq">
          <div className="sales-ref-inner sales-ref-faq">
            <div>
              <ShieldCheck size={22} />
              <h3>Does this replace ERP?</h3>
              <p>No. ERP remains the system of record. Inventory AI is the exception and explanation layer.</p>
            </div>
            <div>
              <FileSpreadsheet size={22} />
              <h3>What files are needed?</h3>
              <p>Products, inventory lots, customers, orders, and inbound shipments are enough for the MVP.</p>
            </div>
            <div>
              <MessageSquareText size={22} />
              <h3>What can users ask?</h3>
              <p>Stockout risk, expiring inventory, reorder actions, FEFO priority, and customer cadence.</p>
            </div>
            <div>
              <PackageCheck size={22} />
              <h3>What proves ROI?</h3>
              <p>Waste dollars protected, fill-rate exceptions surfaced, and planner triage time reduced.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="sales-ref-footer">
        <span>©2026 SUPREME AI VENTURES LLC</span>
        <span>Expiration-aware inventory intelligence tailored for OTOKI-style food operations.</span>
      </footer>
    </div>
  );
}
