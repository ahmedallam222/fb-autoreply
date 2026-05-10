/**
 * Preset rules offered to a new tenant in the onboarding wizard.
 *
 * The frontend lets the user check which presets to import; the API
 * inserts the selected ones via POST /api/rules during step 3.
 */
export interface RuleTemplate {
  key: string;
  name: string;
  channel: 'comment' | 'message' | 'both';
  matchType: 'contains' | 'exact' | 'starts_with' | 'regex';
  keywords: string[];
  responseTemplate: string;
  priority: number;
  description: string;
}

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    key: 'pricing',
    name: 'Pricing question',
    channel: 'both',
    matchType: 'contains',
    keywords: ['price', 'pricing', 'cost', 'how much', 'سعر', 'بكام', 'تكلفة'],
    responseTemplate:
      'Hi {{first_name}}! Thanks for reaching out — please check our pricing page or DM us for a tailored quote.',
    priority: 10,
    description: 'Reply when someone asks about pricing or cost.',
  },
  {
    key: 'hours',
    name: 'Working hours',
    channel: 'both',
    matchType: 'contains',
    keywords: ['hours', 'open', 'working', 'available', 'ميعاد', 'مواعيد', 'بتفتحوا'],
    responseTemplate:
      'Hi {{first_name}}! We are open Sunday–Thursday, 10am–10pm. We will get back to you within working hours.',
    priority: 8,
    description: 'Reply with your business hours.',
  },
  {
    key: 'shipping',
    name: 'Shipping & delivery',
    channel: 'both',
    matchType: 'contains',
    keywords: ['shipping', 'delivery', 'ship', 'تسليم', 'شحن', 'توصيل'],
    responseTemplate:
      'Hi {{first_name}}! We ship within 2–4 business days. Inside-city delivery typically arrives the next day.',
    priority: 8,
    description: 'Reply when someone asks about shipping or delivery.',
  },
  {
    key: 'greeting',
    name: 'Greeting',
    channel: 'both',
    matchType: 'contains',
    keywords: ['hi', 'hello', 'hey', 'سلام', 'اهلا', 'مرحبا'],
    responseTemplate: 'Hello {{first_name}}! 👋 How can we help you today?',
    priority: 5,
    description: 'Friendly greeting when the conversation starts with hi/hello.',
  },
  {
    key: 'thanks',
    name: 'Thanks reply',
    channel: 'both',
    matchType: 'contains',
    keywords: ['thanks', 'thank you', 'شكرا', 'متشكر'],
    responseTemplate: 'You are welcome, {{first_name}}! Let us know if you need anything else.',
    priority: 5,
    description: 'Acknowledge a thank-you message.',
  },
];
