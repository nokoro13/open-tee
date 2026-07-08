export const LEGAL_LAST_UPDATED = "July 8, 2026";

export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export const termsSections: LegalSection[] = [
  {
    title: "1. Agreement",
    paragraphs: [
      "These Terms of Service (“Terms”) govern your use of OpenRound (“we”, “us”, “our”), a web platform for hosting and managing golf tournaments. By creating an account, publishing an event, registering as a player, or otherwise using OpenRound, you agree to these Terms.",
      "If you do not agree, do not use the service.",
    ],
  },
  {
    title: "2. The service",
    paragraphs: [
      "OpenRound provides tools for organizers to create events, accept registrations and payments, manage pairings, collect scores, and display live leaderboards. Players and volunteers access event pages through public links without installing an app.",
      "We may update features, pricing, or availability at any time. Material changes will be reflected on this page with an updated date.",
    ],
  },
  {
    title: "3. Accounts and organizers",
    paragraphs: [
      "Organizers must provide accurate account and organization information. You are responsible for activity under your account and for the events you publish.",
      "You represent that you have authority to run the events you create and to collect entry fees on behalf of your organization or club.",
    ],
  },
  {
    title: "4. Payments",
    paragraphs: [
      "Player entry fees are processed through Stripe. OpenRound does not store full payment card numbers.",
      "Organizers pay a platform fee when publishing an event. Platform fees are charged at publish and are non-refundable except where required by law.",
      "Refunds of player entry fees are handled between the player and the event organizer unless otherwise stated on the event page. See our refund policy on each registration page.",
    ],
  },
  {
    title: "5. Acceptable use",
    paragraphs: [
      "You may not use OpenRound to publish fraudulent events, misrepresent event details, harass other users, scrape the service, or interfere with its operation.",
      "We may suspend or terminate access for violations of these Terms or for conduct that harms other users or the platform.",
    ],
  },
  {
    title: "6. Content and data",
    paragraphs: [
      "You retain ownership of event and registration data you submit. You grant OpenRound a license to host, display, and process that data to operate the service (for example, showing player names on a leaderboard).",
      "Course data may be sourced from third-party providers and is provided for convenience without warranty of completeness or accuracy.",
    ],
  },
  {
    title: "7. Disclaimers",
    paragraphs: [
      "OpenRound is provided “as is” without warranties of any kind. We do not guarantee uninterrupted service, especially on tournament days where cellular coverage may vary.",
      "We are not responsible for disputes between organizers and players regarding refunds, pairings, scoring, or handicaps.",
    ],
  },
  {
    title: "8. Limitation of liability",
    paragraphs: [
      "To the maximum extent permitted by law, OpenRound’s total liability arising from your use of the service is limited to the amount you paid to OpenRound in the twelve months before the claim.",
    ],
  },
  {
    title: "9. Contact",
    paragraphs: [
      "Questions about these Terms: contact the OpenRound team through the email address listed on our website or event communications.",
    ],
  },
];

export const privacySections: LegalSection[] = [
  {
    title: "1. Overview",
    paragraphs: [
      "This Privacy Policy describes how OpenRound collects, uses, and shares information when you use our website and tournament management tools.",
    ],
  },
  {
    title: "2. Information we collect",
    paragraphs: [
      "Account information: name, email address, and authentication data when organizers sign up (via our auth provider).",
      "Event and registration data: player names, email addresses, optional handicap information, payment status, group assignments, and scores entered during tournaments.",
      "Payment information: processed by Stripe; we receive payment status and transaction identifiers, not full card numbers.",
      "Usage data: standard server logs, device/browser type, and pages visited to keep the service secure and reliable.",
    ],
  },
  {
    title: "3. How we use information",
    paragraphs: [
      "We use information to operate the platform: process registrations, send transactional emails (confirmations, scoring links), display leaderboards, and bill organizers for platform fees.",
      "We do not sell personal information. We do not send marketing emails unless you opt in separately.",
    ],
  },
  {
    title: "4. Sharing",
    paragraphs: [
      "We share data with service providers that help us run OpenRound, including hosting, email delivery, payment processing, and authentication.",
      "Public event pages and leaderboards display player names and scores as configured by the organizer. Anyone with the event link can view that information.",
    ],
  },
  {
    title: "5. Retention",
    paragraphs: [
      "We retain event and registration records while your account is active and for a reasonable period afterward so organizers can access historical results. You may request deletion of your organization’s data by contacting us.",
      "Some records may be kept longer where required for legal, tax, or payment compliance.",
    ],
  },
  {
    title: "6. Security",
    paragraphs: [
      "We use industry-standard practices to protect data in transit and at rest. No method of transmission over the internet is 100% secure.",
      "Organizers should share scoring links only with trusted volunteers.",
    ],
  },
  {
    title: "7. Your choices",
    paragraphs: [
      "Players register with the information required by the organizer. Contact the event organizer to update or remove registration details for a specific event.",
      "Organizers can manage their organization profile and event data from the dashboard.",
    ],
  },
  {
    title: "8. Changes and contact",
    paragraphs: [
      "We may update this policy from time to time. The “Last updated” date at the top reflects the latest version.",
      "Privacy questions: contact us through the address on our website.",
    ],
  },
];
