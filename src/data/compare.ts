/**
 * How LibreDB Studio compares.
 *
 * WHY THIS IS NOT A FEATURE GRID. The previous site scored five checkboxes
 * against DataGrip, DBeaver, pgAdmin and TablePlus, and gave itself five greens
 * while giving every competitor almost nothing. That table was wrong on its own
 * terms — it marked AI as absent from tools that ship an AI assistant, and SSO
 * as absent from tools that sell it — and it published competitor prices, which
 * go stale within a quarter and are somebody else's to state. An all-green row
 * next to four all-red rows is also the least believed shape a comparison can
 * take: the reader's first move is to look for the one they know about, find it
 * misrepresented, and stop reading.
 *
 * So this compares APPROACHES, and names tools only as examples of each. The
 * difference that actually matters is where the tool runs relative to the data,
 * and that is a fact about architecture rather than a feature anyone ships in
 * their next release. It does not go stale, it does not require asserting
 * anything about a competitor's roadmap, and it is the reason someone switches.
 *
 * RULE for edits: nothing here may claim a named product lacks a feature. State
 * what the APPROACH implies, which is defensible, and let the reader map their
 * own tool onto it.
 */

export interface Approach {
  id: string;
  name: string;
  examples: string;
  /** what this shape is genuinely good at — stated first, and meant */
  strength: string;
  /** the cost that comes with the shape, not with any one product */
  cost: string;
}

export const approaches: Approach[] = [
  {
    id: 'desktop',
    name: 'The desktop client',
    examples: 'DataGrip, DBeaver, TablePlus, pgAdmin in desktop mode',
    strength:
      'The richest editors in the category, and they answer to nobody but you. Offline, fast, deeply featured, and yours to configure.',
    cost: 'It runs on your laptop, so the database has to be reachable from your laptop: a public port, a bastion, a VPN or an SSH tunnel. Every new machine and every new colleague repeats that setup, and the credential ends up on each of those machines.',
  },
  {
    id: 'hosted',
    name: 'The hosted SQL editor',
    examples: 'Vendor-run web consoles and SaaS query tools',
    strength: 'Nothing to install and nothing to run. A link, a login, and a query box.',
    cost: 'Your data crosses a boundary you do not control, and the vendor needs a route into your database to make that work. For some data that is a procurement conversation; for some it is a no.',
  },
  {
    id: 'beside',
    name: 'Deployed beside the data',
    examples: 'LibreDB Studio',
    strength:
      'One container inside the same network as the database. Nothing is exposed, nothing leaves the perimeter, and the browser is the only client anyone installs. Access is granted through your identity provider and revoked there too.',
    cost: 'Something has to run it. That is a container or a Helm release you own and update — cheap next to a VPN rollout, but it is not nothing.',
  },
];

export interface Consequence {
  question: string;
  desktop: string;
  beside: string;
}

/**
 * The consequences, phrased as the questions people actually arrive with. Two
 * columns, not five: the hosted column would repeat the desktop answer on the
 * operational rows and the "no" on the data-boundary ones.
 */
export const consequences: Consequence[] = [
  {
    question: 'Reaching a database in a private network',
    desktop: 'Expose a port, or dig a tunnel per person, per machine.',
    beside: 'Already inside it. Nothing is exposed to reach it.',
  },
  {
    question: 'Onboarding the fifth engineer',
    desktop: 'Install, licence, configure, distribute credentials.',
    beside: 'Send a URL. Their SSO account decides what they can see.',
  },
  {
    question: 'Revoking access on their last day',
    desktop: 'Rotate every credential they were given a copy of.',
    beside: 'Disable the account in your identity provider.',
  },
  {
    question: 'Answering "who ran that query?"',
    desktop: 'Whatever the database server happened to log.',
    beside: 'An audit trail against a person, in the tool.',
  },
  {
    question: 'Reading production from a phone at 2am',
    desktop: 'Not a thing a desktop client does.',
    beside: 'A browser is a browser.',
  },
  {
    question: 'Working across several engines at once',
    desktop: 'Depends on the tool; often several tools.',
    beside: 'Seventeen engines behind one tab and one grid.',
  },
];

export const closing = {
  headline: 'This is not a claim that desktop clients are bad',
  body: 'They are the most capable editors in the category, and for a laptop-and-a-local-database day they are the right answer. The argument here is narrower: the databases moved into Kubernetes, into PaaS platforms and into customers’ private networks, and a tool that runs on your laptop now has to be tunnelled to each of them. LibreDB Studio moves the tool instead of the network.',
};
