import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/marketing/MarketingShell";

export const metadata: Metadata = { title: "Privacy Policy", description: "AlgoBook Privacy Policy — how we collect, use and protect your data." };

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy Policy" updated="September 8, 2026" intro={<>AlgoBook (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is operated by CognitiveSquad. This Privacy Policy explains how we collect, use, disclose and safeguard your information when you use our platform at algobook.ai.</>}>
      <section>
        <h2>1. Information we collect</h2>
        <h3>1.1 Account information</h3>
        <p>When you sign in with Google, we receive your name, email address and profile picture from your Google account. We never see your Google password.</p>
        <h3>1.2 Usage data</h3>
        <p>We collect data about how you use AlgoBook, including:</p>
        <ul>
          <li>Problems generated, attempted and solved, and the hints, editorials and tutor conversations you open</li>
          <li>Code submissions, run results and execution metrics</li>
          <li>Project creation, activity patterns, practice streaks and performance metrics such as topic mastery and rating</li>
          <li>Time spent on problems and in mock interviews</li>
        </ul>
        <h3>1.3 Technical data</h3>
        <p>We automatically collect certain technical information including browser type, device information, IP address and pages visited. This is collected through Google Analytics and our server logs.</p>
      </section>
      <section>
        <h2>2. How we use your information</h2>
        <ul>
          <li>Provide and maintain the AlgoBook platform</li>
          <li>Personalise your practice with AI-powered recommendations, spaced repetition and difficulty calibration</li>
          <li>Track your progress and generate performance analytics, leaderboards and achievements</li>
          <li>Process subscription payments</li>
          <li>Communicate with you about your account and updates</li>
          <li>Improve our services and develop new features</li>
          <li>Prevent fraud and abuse and keep the platform secure</li>
        </ul>
      </section>
      <section>
        <h2>3. Data sharing</h2>
        <p>We do not sell your personal information. We may share data with:</p>
        <ul>
          <li><strong>Service providers:</strong> Google Firebase (authentication and database), an AI model provider (problem generation and tutoring — your code and problem context are sent, never your email or identity), a code-execution provider (your submitted code and test inputs), and payment processors for subscription handling.</li>
          <li><strong>Legal requirements:</strong> if required by law, court order or governmental regulation.</li>
          <li><strong>Public profile:</strong> your username, display name, avatar, bio, skills, badges and solve statistics are visible on your public profile page and on leaderboards. Your email, quotas and private settings are never public. You can turn the public profile off in Settings → Privacy.</li>
        </ul>
      </section>
      <section>
        <h2>4. Data storage &amp; security</h2>
        <p>Your data is stored on Google Cloud (via Firebase) with encryption at rest and in transit. Every API request is authenticated with a short-lived token and access rules are enforced server-side. We implement industry-standard security measures, but no method of electronic storage is 100 % secure.</p>
      </section>
      <section>
        <h2>5. Your rights</h2>
        <ul>
          <li>Access the personal data we hold about you</li>
          <li>Request correction of inaccurate data</li>
          <li>Delete your account and associated data yourself from Settings → Danger zone (the subscription ledger is retained for accounting)</li>
          <li>Export your submission history and profile data</li>
          <li>Opt out of marketing communications</li>
        </ul>
      </section>
      <section>
        <h2>6. Cookies &amp; analytics</h2>
        <p>We use Google Analytics to understand how people use AlgoBook. We also use local storage to remember your editor layout, theme and drafts on the device you are using.</p>
      </section>
      <section>
        <h2>7. Children&rsquo;s privacy</h2>
        <p>AlgoBook is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us.</p>
      </section>
      <section>
        <h2>8. Changes to this policy</h2>
        <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the &ldquo;Last updated&rdquo; date.</p>
      </section>
      <section>
        <h2>9. Contact us</h2>
        <p>If you have any questions about this Privacy Policy, email <a href="mailto:contact@cognitivesquad.com">contact@cognitivesquad.com</a> or use the <Link href="/contact">contact form</Link>.</p>
      </section>
    </ProsePage>
  );
}
