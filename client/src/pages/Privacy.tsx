import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/ui";

export const PRIVACY_UPDATED = "November 7, 2026";
/** Contact address shown on the page. Empty = no address listed. */
export const PRIVACY_CONTACT = "colischdaniel@gmail.com";

function S({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="display text-[18px]">{title}</h2>
      <div className="stack mt-2 text-sm muted leading-relaxed" style={{ gap: 8 }}>{children}</div>
    </section>
  );
}
const L = ({ children }: { children: ReactNode }) => <ul className="stack" style={{ gap: 6, paddingLeft: 18, listStyle: "disc" }}>{children}</ul>;

export default function PrivacyPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="app" data-testid="page-privacy">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Back" data-testid="button-privacy-back"><ArrowLeft size={18} /></button>
        <Wordmark />
      </div>
      <div className="screen" style={{ paddingBottom: 60 }}>
        <p className="label mt-4">Privacy · updated {PRIVACY_UPDATED}</p>
        <h1 className="display text-[30px] mt-2">Your data, in plain language</h1>
        <p className="text-sm muted mt-3 leading-relaxed">Corpus holds personal things: your body weight, sleep, meals and photos. This page explains what's stored, who can see it, and how to get it back or delete it.</p>

        <div className="card mt-5 stack" style={{ gap: 6 }}>
          <div className="text-sm"><span className="lime mono">—</span> No ads, and we don't sell or rent your data.</div>
          <div className="text-sm"><span className="lime mono">—</span> No analytics or tracking tools.</div>
          <div className="text-sm"><span className="lime mono">—</span> Spotters and coaches only see what your settings allow.</div>
          <div className="text-sm"><span className="lime mono">—</span> You can export everything or delete your account anytime.</div>
        </div>

        <S title="What we store">
          <p><b className="text-[var(--text)]">Your account:</b> username, display name, whether you're a coach, your invite code and your sharing settings. Your password and recovery code are stored only in scrambled (hashed) form, so no one can read them, including us.</p>
          <p><b className="text-[var(--text)]">Your training data:</b> the profile you set up (age, sex, height, weight, goal), your program, workouts and sets, daily check-ins (sleep, HRV, soreness, stress and so on), meals and foods, body measurements, progress photos, experiments and notes. It's saved to your account so it syncs across your devices.</p>
          <p><b className="text-[var(--text)]">Social activity:</b> who your Spotters are, workout posts, likes, comments and gym check-ins.</p>
        </S>

        <S title="Who can see what">
          <p><b className="text-[var(--text)]">Only you</b> see your full log, check-ins, meals, measurements and photos by default.</p>
          <p><b className="text-[var(--text)]">Spotters</b> are people you've connected with by code or invite link. They can see:</p>
          <L>
            <li>Your name and username.</li>
            <li>Finished workouts posted to the feed, if <i className="not-italic text-[var(--text)]">Share workouts</i> is on.</li>
            <li>Best lifts, body weight, streak and training split on leaderboards, if <i className="not-italic text-[var(--text)]">Share lifts on leaderboards</i> is on.</li>
            <li>Your gym check-ins (gym name and time, shown for 3 hours), with your split and streak.</li>
            <li>Comments and likes you leave on their posts.</li>
          </L>
          <p><b className="text-[var(--text)]">Coaches</b> can see your data only after you link with their coach code. A linked coach gets a read-only view of your program, workouts, check-ins and meals. Progress photos and measurements are included only if <i className="not-italic text-[var(--text)]">Share private vault</i> is on. Coaches never see your Spotters or feed, and can't change your data. Remove a coach anytime in Profile.</p>
          <p><b className="text-[var(--text)]">Everyone else</b> sees nothing. If someone opens your invite link, it shows only your name and username.</p>
        </S>

        <S title="Services we rely on">
          <L>
            <li><b className="text-[var(--text)]">Supabase</b> stores the database.</li>
            <li><b className="text-[var(--text)]">Perplexity</b> hosts the app at pplx.app.</li>
            <li><b className="text-[var(--text)]">USDA FoodData Central</b> and <b className="text-[var(--text)]">Open Food Facts</b> answer food searches and barcode lookups. Our server sends only the search words or barcode number, never your name or account.</li>
            <li><b className="text-[var(--text)]">Google Fonts</b> supplies the typefaces, so your browser contacts Google to load them.</li>
          </L>
          <p>Barcode scanning uses your camera on your phone only. The video is never uploaded.</p>
        </S>

        <S title="Cookies and your device">
          <p>One cookie keeps you signed in. Your phone also remembers a few small settings, like whether you've dismissed the home screen tip. Nothing is used to track you across other sites.</p>
        </S>

        <S title="Keeping it safe">
          <p>All traffic is encrypted (HTTPS). Passwords and recovery codes are hashed. Sign-in and password resets are rate-limited to stop guessing, and changing your password signs out your other devices.</p>
        </S>

        <S title="Your controls">
          <L>
            <li><b className="text-[var(--text)]">Export:</b> Profile → Export JSON downloads all your training data.</li>
            <li><b className="text-[var(--text)]">Sharing:</b> turn workout and leaderboard sharing on or off in Profile, remove Spotters in the Social tab, and remove coaches in Profile.</li>
            <li><b className="text-[var(--text)]">Delete:</b> Profile → Delete account permanently removes your login, training data, posts, Spotters and coach links right away.</li>
          </L>
        </S>

        <S title="Health information">
          <p>Corpus gives training and nutrition suggestions based on what you log. It isn't medical advice. Talk to a doctor before big changes, especially with an injury or health condition.</p>
        </S>

        <S title="Changes and contact">
          <p>If this page changes, the date at the top changes too.{PRIVACY_CONTACT ? <> Questions or requests: <a className="lime" style={{ display: "inline-block", padding: "12px 0" }} href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>.</> : " For questions, contact the person who invited you to Corpus."}</p>
        </S>

        <button className="btn btn-block mt-8" onClick={onBack} data-testid="button-privacy-done">Back to Corpus</button>
      </div>
    </div>
  );
}
