export interface SeedEmail {
  from_address: string;
  from_name: string;
  subject: string;
  body_text: string;
}

export const SEED_EMAILS: SeedEmail[] = [
  {
    from_address: "john.smith@example.com",
    from_name: "John Smith",
    subject: "Refund not processed - it's been 2 weeks!",
    body_text: "I requested a refund for order #4892 over two weeks ago and still haven't received it. This is completely unacceptable. I've been a loyal customer for 3 years and this is how I'm treated? I need this resolved immediately or I'm disputing the charge with my bank.",
  },
  {
    from_address: "sarah.lee@example.com",
    from_name: "Sarah Lee",
    subject: "URGENT: Can't access my account - locked out",
    body_text: "My account has been locked and I can't access the dashboard at all. I've tried resetting my password three times but keep getting an error. I have a critical deadline today and need access to my files immediately. Please help ASAP.",
  },
  {
    from_address: "mike.chen@example.com",
    from_name: "Mike Chen",
    subject: "Charged twice for my subscription",
    body_text: "I noticed two charges of $29.99 on my credit card statement this month for my subscription. I should only be charged once. Can you please look into this and refund the duplicate charge? My account email is mike.chen@example.com.",
  },
  {
    from_address: "emma.wilson@example.com",
    from_name: "Emma Wilson",
    subject: "When will my order ship?",
    body_text: "Hi, I placed order #7721 three days ago and the status still shows 'processing'. Could you let me know when it's expected to ship? I need it by next Friday for an event. Thanks!",
  },
  {
    from_address: "alex.rivera@example.com",
    from_name: "Alex Rivera",
    subject: "Thank you for the amazing support!",
    body_text: "I just wanted to say thank you to your support team, especially Jessica who helped me last week. She went above and beyond to resolve my issue and I really appreciate it. Keep up the great work!",
  },
  {
    from_address: "priya.patel@example.com",
    from_name: "Priya Patel",
    subject: "Feature request: Dark mode for the dashboard",
    body_text: "I use your dashboard daily and would love to see a dark mode option. Working late at night with the bright white interface is tough on the eyes. I know other users have requested this too. Any plans to add it?",
  },
  {
    from_address: "david.kim@example.com",
    from_name: "David Kim",
    subject: "Question about my invoice",
    body_text: "Hi, I received invoice #INV-2024-0892 but the amount doesn't match what I expected based on our agreement. Could someone review this? I believe the discount we discussed wasn't applied. My account number is DK-44821.",
  },
  {
    from_address: "lisa.thompson@example.com",
    from_name: "Lisa Thompson",
    subject: "Partnership inquiry - Integration opportunity",
    body_text: "Hi there, I'm the Head of Partnerships at TechFlow Inc. We're interested in exploring an integration between our platforms. I think there's a great opportunity for both our user bases. Would someone from your team be available for a call next week to discuss?",
  },
];
