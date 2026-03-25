import type { Metadata } from "next";
import Link from "next/link";
import { Code2, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "AlgoBook Privacy Policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Code2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">AlgoBook</span>
          </Link>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: March 25, 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-muted-foreground [&_h2]:text-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:text-foreground [&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-6 [&_h3]:mb-2 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1">
          <p className="text-base text-foreground/80 leading-relaxed">
            AlgoBook (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is operated by CognitiveSquad. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform at algobook.ai.
          </p>

          <h2>1. Information We Collect</h2>
          <h3>1.1 Account Information</h3>
          <p>When you sign in with Google, we receive your name, email address, and profile picture from your Google account. We do not access your Google password.</p>

          <h3>1.2 Usage Data</h3>
          <p>We collect data about how you use AlgoBook, including:</p>
          <ul>
            <li>Questions generated and solved</li>
            <li>Code submissions and execution results</li>
            <li>Project creation and activity patterns</li>
            <li>Practice streaks and performance metrics</li>
            <li>Time spent on questions</li>
          </ul>

          <h3>1.3 Technical Data</h3>
          <p>We automatically collect certain technical information including browser type, device information, IP address, and pages visited. This is collected through Google Analytics.</p>

          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide and maintain the AlgoBook platform</li>
            <li>Personalize your learning experience with AI-powered recommendations</li>
            <li>Track your progress and generate performance analytics</li>
            <li>Process subscription payments</li>
            <li>Communicate with you about your account and updates</li>
            <li>Improve our services and develop new features</li>
            <li>Prevent fraud and ensure platform security</li>
          </ul>

          <h2>3. Data Sharing</h2>
          <p>We do not sell your personal information. We may share data with:</p>
          <ul>
            <li><strong>Service Providers:</strong> Firebase (authentication and database), OpenAI (question generation), payment processors for subscription handling.</li>
            <li><strong>Legal Requirements:</strong> If required by law, court order, or governmental regulation.</li>
            <li><strong>Public Profile:</strong> If you choose to make your profile public, your username, bio, skills, and submission statistics will be visible to anyone with the link.</li>
          </ul>

          <h2>4. Data Storage &amp; Security</h2>
          <p>Your data is stored on Google Cloud (via Firebase) with encryption at rest and in transit. We implement industry-standard security measures to protect your information, but no method of electronic storage is 100% secure.</p>

          <h2>5. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and associated data</li>
            <li>Export your submission history and profile data</li>
            <li>Opt-out of marketing communications</li>
          </ul>

          <h2>6. Cookies &amp; Analytics</h2>
          <p>We use Google Analytics to understand how users interact with AlgoBook. We also use session storage and local storage to improve your experience (e.g., caching subscription status, tracking attendance).</p>

          <h2>7. Children&apos;s Privacy</h2>
          <p>AlgoBook is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us.</p>

          <h2>8. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.</p>

          <h2>9. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us at:</p>
          <p><strong>Email:</strong> contact@cognitivesquad.com</p>
        </div>
      </main>
    </div>
  );
}
