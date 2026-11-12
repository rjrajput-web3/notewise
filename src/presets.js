/**
 * Notewise — 1-Click Sample Notes / Interactive Demo Presets.
 *
 * Three rich, realistic datasets with FULLY PRE-COMPUTED outputs. When a
 * preset is loaded, the workspace shows its output instantly with a
 * "Live Preview Mode" badge — no API call, zero chance of a failure during
 * a demo or judging. Every pre-computed answer is grounded in the preset
 * body text; nothing is invented.
 *
 * Presets:
 *  A. Lecture Notes      → Structured Summary & Flashcards
 *  B. Research Paper     → Actionable Mindmap
 *  C. Meeting Transcript → Key Decisions
 */

export const PRESETS = [
  {
    id: "lecture-nn",
    label: "Lecture Notes",
    title: "Intro to Neural Networks — Lecture 7",
    tagline: "Structured summary & flashcards",
    icon: "cap",
    body: [
      "Lecture 7 — Introduction to Neural Networks (Prof. Alvarez, 10 Nov)",
      "",
      "A neural network is a stack of layers of simple computing units, loosely inspired by the brain. Each unit takes many inputs, computes a weighted sum plus a bias term, and passes the result through a non-linear activation function.",
      "",
      "The perceptron is the simplest unit: output = activation(w1*x1 + w2*x2 + ... + b). Common activation functions are sigmoid, tanh and ReLU. ReLU (max(0, x)) is the default in hidden layers today because it avoids the vanishing-gradient problem that makes sigmoid and tanh train slowly in deep networks.",
      "",
      "Training: first a forward pass computes the prediction and the loss — how wrong the prediction is. Backpropagation then computes the gradient of the loss with respect to every weight, using the chain rule, working backwards from the output layer. Gradient descent updates each weight by taking a small step in the opposite direction of its gradient. The learning rate sets the size of that step: too large and training diverges, too small and it takes forever.",
      "",
      "Deep learning simply means networks with many hidden layers. With enough data and compute (GPUs), deep networks learn rich features — edges, then shapes, then whole objects in vision. The main danger is overfitting: the network memorizes the training data and fails on new examples. Standard defences are more training data, dropout (randomly switching units off during training), L2 regularization, and early stopping.",
      "",
      "Next lecture: convolutional networks for images."
    ].join("\n"),
    output: {
      summary: {
        summary:
          "A neural network stacks layers of simple units that turn inputs into predictions: each unit computes a weighted sum plus a bias, then applies a non-linear activation like ReLU. Training runs a forward pass to measure the loss, backpropagates gradients to every weight, and updates them with gradient descent. Deep networks learn rich features from large data, but they risk overfitting — fought with dropout, regularization, and early stopping.",
        title: "Neural Networks: Units, Training, Overfitting",
        tags: ["neural-networks", "backpropagation", "gradient-descent", "relu", "overfitting"]
      },
      takeaways: [
        "A perceptron outputs an activation of its weighted input sum plus a bias.",
        "ReLU is the default hidden-layer activation because it avoids the vanishing-gradient problem of sigmoid and tanh.",
        "Backpropagation computes the gradient of the loss with respect to every weight, working backwards from the output.",
        "Gradient descent updates weights in small steps set by the learning rate — too large diverges, too small crawls.",
        "Overfitting is fought with more data, dropout, L2 regularization, and early stopping."
      ],
      research: [
        "## Key ideas",
        "- A neural network is a stack of layers of simple units, each computing a weighted sum plus bias through a non-linear activation.",
        "- ReLU (max(0, x)) is the default hidden-layer activation because it avoids vanishing gradients.",
        "- Training = forward pass to measure loss, backpropagation to compute gradients, gradient descent to update weights.",
        "- Deep networks learn hierarchical features, but risk overfitting without dropout, regularization, or early stopping.",
        "",
        "## Background",
        "The perceptron dates to the 1950s, but deep networks only became practical with large labelled datasets and GPU compute. The lecture frames the whole field as three ideas: units, a loss to minimize, and a way to compute gradients.",
        "",
        "## Connections",
        "- Activation choice (ReLU vs sigmoid) directly determines whether gradients survive through many layers.",
        "- The learning rate links optimization theory to practice: it is the single most sensitive training hyperparameter.",
        "- Dropout and early stopping both limit how much the network can memorize its training data.",
        "",
        "## Open questions",
        "1. When would you still choose sigmoid or tanh over ReLU?",
        "2. How does the learning rate interact with batch size in practice?",
        "3. What would you measure to decide whether a model is overfitting or underfitting?",
        "",
        "_Live Preview — pre-computed from the lecture notes._"
      ].join("\n"),
      quiz: [
        {
          q: "What does a perceptron compute?",
          options: [
            "A weighted sum of its inputs plus a bias, passed through an activation function",
            "The average of its inputs, with no weights",
            "A random sample from its training data",
            "The gradient of the loss function directly"
          ],
          answer: 0,
          why: "The lecture defines a unit as output = activation(w·x + b)."
        },
        {
          q: "Why is ReLU the default activation in hidden layers?",
          options: [
            "It is the oldest activation function",
            "It avoids the vanishing-gradient problem of sigmoid and tanh",
            "It makes the network train on less data",
            "It removes the need for a bias term"
          ],
          answer: 1,
          why: "ReLU keeps gradients alive in deep networks, unlike sigmoid and tanh."
        },
        {
          q: "What does backpropagation compute?",
          options: [
            "The prediction for the next input",
            "The gradient of the loss with respect to every weight",
            "The best learning rate for the network",
            "The number of hidden layers needed"
          ],
          answer: 1,
          why: "Backpropagation uses the chain rule, working backwards from the output layer."
        },
        {
          q: "What does the learning rate control?",
          options: [
            "How many layers the network has",
            "The size of each weight-update step in gradient descent",
            "How much data the network sees",
            "Whether dropout is switched on"
          ],
          answer: 1,
          why: "Too large and training diverges; too small and it takes forever."
        },
        {
          q: "Which of these fights overfitting?",
          options: [
            "Training for more epochs without validation",
            "Removing the bias terms",
            "Dropout — randomly switching units off during training",
            "Using a larger learning rate"
          ],
          answer: 2,
          why: "Dropout, more data, L2 regularization, and early stopping are the lecture's defences."
        }
      ]
    }
  },
  {
    id: "paper-transformer",
    label: "Research Paper",
    title: "Attention Is All You Need — Paper Notes",
    tagline: "Actionable mindmap",
    icon: "paper",
    body: [
      "Paper notes — Vaswani et al. (2017), 'Attention Is All You Need'",
      "",
      "The Transformer is a sequence model built entirely on self-attention, with no recurrence and no convolution. Self-attention lets every token weigh every other token in the sequence, so long-range dependencies are captured in parallel instead of step by step.",
      "",
      "Because attention itself has no sense of word order, the model adds positional encodings to the input embeddings. Multi-head attention runs several attention functions in parallel, so the model can attend to different types of relationships — syntax in one head, coreference in another — at the same time.",
      "",
      "Results: on English–German translation the Transformer reached 28.4 BLEU, beating the best previous models, while training in a fraction of the time (3.5 days on 8 GPUs). On English–French it reached 41.0 BLEU. The paper also showed the same architecture works for parsing and other tasks with minimal changes.",
      "",
      "Why it matters: the Transformer became the foundation for BERT, GPT, and nearly every modern large language model. The key insight is that attention alone, scaled up, is enough — recurrence is not required for sequence modelling.",
      "",
      "Open threads: attention cost grows quadratically with sequence length; later work (sparse attention, linear attention) attacks exactly this."
    ].join("\n"),
    output: {
      summary: {
        summary:
          "The Transformer (Vaswani et al., 2017) models sequences with self-attention alone — no recurrence, no convolution. Each token weighs every other token in parallel, positional encodings restore word order, and multi-head attention captures different relationship types at once. It reached 28.4 BLEU on English–German translation while training far faster than prior models, and became the foundation for BERT, GPT, and nearly every modern large language model.",
        title: "The Transformer: Attention Alone Is Enough",
        tags: ["transformer", "attention", "nlp", "vaswani", "deep-learning"]
      },
      takeaways: [
        "The Transformer uses self-attention only — no recurrence, no convolution.",
        "Self-attention lets every token weigh every other token, capturing long-range dependencies in parallel.",
        "Positional encodings are required because attention has no sense of word order.",
        "Multi-head attention runs several attention functions in parallel for different relationship types.",
        "28.4 BLEU on English–German, trained in 3.5 days on 8 GPUs — faster and better than prior models.",
        "The architecture underpins BERT, GPT, and nearly every modern LLM."
      ],
      mindmap: {
        center: "Transformer (2017)",
        branches: [
          {
            label: "Self-Attention",
            children: ["Every token weighs every other token", "Long-range dependencies in parallel", "No recurrence needed"]
          },
          {
            label: "Positional Encoding",
            children: ["Restores word order", "Added to input embeddings"]
          },
          {
            label: "Multi-Head Attention",
            children: ["Several attention functions in parallel", "Different relationship types per head"]
          },
          {
            label: "Results",
            children: ["28.4 BLEU (EN–DE)", "41.0 BLEU (EN–FR)", "3.5 days on 8 GPUs"]
          },
          {
            label: "Impact",
            children: ["Foundation for BERT & GPT", "Basis of modern LLMs", "Open thread: quadratic cost"]
          }
        ]
      },
      research: [
        "## Key ideas",
        "- The Transformer is built entirely on self-attention — no recurrence, no convolution.",
        "- Self-attention lets every token weigh every other token, capturing long-range dependencies in parallel.",
        "- Positional encodings inject word order, which attention alone cannot see.",
        "- Multi-head attention attends to different relationship types simultaneously.",
        "",
        "## Background",
        "Before 2017, sequence models were recurrent (slow, sequential) or convolutional (limited context). The paper's bet was that attention, scaled up and parallelized, could replace both — and the BLEU scores proved it.",
        "",
        "## Connections",
        "- Parallel attention is what makes large-scale training on GPUs practical.",
        "- The same architecture transfers to parsing and other tasks with minimal changes.",
        "- Quadratic attention cost is the direct motivation for later sparse and linear attention work.",
        "",
        "## Open questions",
        "1. How would you handle sequences far longer than the training context?",
        "2. Which head in a multi-head layer would you inspect to find syntactic relations?",
        "3. What breaks first if you remove positional encodings?",
        "",
        "_Live Preview — pre-computed from the paper notes._"
      ].join("\n"),
      quiz: [
        {
          q: "What did the Transformer replace?",
          options: [
            "Recurrence and convolution in sequence models",
            "The feed-forward network",
            "The loss function",
            "Token embeddings"
          ],
          answer: 0,
          why: "The paper builds the model entirely on self-attention, with no recurrence or convolution."
        },
        {
          q: "What does self-attention let each token do?",
          options: [
            "Skip the positional encoding",
            "Weigh every other token in the sequence",
            "Choose its own learning rate",
            "Attend only to the previous token"
          ],
          answer: 1,
          why: "Every token weighs every other token, capturing long-range dependencies in parallel."
        },
        {
          q: "Why are positional encodings needed?",
          options: [
            "To shrink the model size",
            "Because attention itself has no sense of word order",
            "To add more attention heads",
            "To compute the BLEU score"
          ],
          answer: 1,
          why: "Attention is order-free, so encodings inject position into the embeddings."
        },
        {
          q: "What does multi-head attention do?",
          options: [
            "Runs several attention functions in parallel",
            "Trains several separate models",
            "Splits the sequence into fixed chunks",
            "Removes the need for embeddings"
          ],
          answer: 0,
          why: "Different heads attend to different types of relationships at the same time."
        },
        {
          q: "What BLEU score did the Transformer reach on English–German?",
          options: ["24.1", "26.8", "28.4", "31.2"],
          answer: 2,
          why: "28.4 BLEU — beating the best previous models while training in 3.5 days on 8 GPUs."
        }
      ]
    }
  },
  {
    id: "meeting-atlas",
    label: "Meeting Transcript",
    title: "Atlas Launch — Sprint Planning (12 Nov)",
    tagline: "Key decisions & action items",
    icon: "meeting",
    body: [
      "Sprint planning — Atlas app launch. Attendees: Priya (PM), Arjun (Eng), Sara (Design), Maya (QA). 12 Nov, 40 min.",
      "",
      "Priya: The launch date has to move. The onboarding flow is not ready and I will not ship a broken first run. New date: 28 November. That gives us two more weeks.",
      "Arjun: Agreed. The API rate limiting is the other blocker — it is half done. I can finish it by the 20th if nobody pulls me onto the billing work.",
      "Priya: Billing stays out of this sprint. Rate limiting is yours, Arjun, and it is the top engineering priority.",
      "Sara: Onboarding mockups will be ready by Friday. One decision I need: do we ship dark mode in v1? My recommendation is no — it doubles the design QA.",
      "Priya: Dark mode is deferred to v1.1. Ship the light onboarding first.",
      "Maya: I need a release checklist before we freeze. I will own it, and I want a freeze date: 25 November, three days before launch, no exceptions.",
      "Priya: Freeze on the 25th, launch on the 28th. Pricing: free tier keeps 3 projects, Pro is $12 per month. Sara, confirm the pricing page copy by Friday too.",
      "Arjun: One more thing — the analytics events for onboarding are not instrumented yet. I will add them with the rate limiting work.",
      "Priya: Good. So: launch 28 Nov, freeze 25 Nov, onboarding first, dark mode v1.1, Pro $12, free tier 3 projects. Maya owns the checklist, Arjun owns rate limiting plus analytics, Sara owns mockups and pricing copy."
    ].join("\n"),
    output: {
      summary: {
        summary:
          "The team moved the Atlas launch to 28 November so the onboarding flow can ship properly, with a hard code freeze on 25 November. Dark mode is deferred to v1.1; the light onboarding ships first. Pricing is set: free tier keeps 3 projects, Pro is $12 per month. Arjun owns API rate limiting plus onboarding analytics, Sara owns mockups and pricing copy by Friday, and Maya owns the release checklist.",
        title: "Atlas Launch: 28 Nov, Freeze 25 Nov",
        tags: ["atlas", "launch", "sprint-planning", "onboarding", "pricing"]
      },
      takeaways: [
        "Launch moved to 28 November — onboarding was not ready and Priya refused to ship a broken first run.",
        "Hard code freeze on 25 November, three days before launch, no exceptions.",
        "Dark mode deferred to v1.1; light onboarding ships first (doubles design QA otherwise).",
        "Pricing set: free tier keeps 3 projects, Pro is $12 per month.",
        "Arjun owns API rate limiting (top engineering priority) plus onboarding analytics events.",
        "Sara owns onboarding mockups and pricing-page copy, both due Friday.",
        "Maya owns the release checklist and the freeze date."
      ],
      research: [
        "## Key ideas",
        "- Launch moved from the original date to 28 November to protect the onboarding first-run experience.",
        "- A hard freeze on 25 November creates a three-day buffer before launch.",
        "- Dark mode is cut from v1 to keep design QA in scope; it ships in v1.1.",
        "- Pricing is decided: free tier 3 projects, Pro $12/month.",
        "",
        "## Background",
        "Two blockers forced the move: the onboarding flow was unfinished and API rate limiting was half done. Billing work was explicitly kept out of the sprint to protect Arjun's time.",
        "",
        "## Connections",
        "- The freeze date and the launch date are linked: the 25th exists to protect the 28th.",
        "- Onboarding analytics (Arjun) and onboarding mockups (Sara) converge on the same Friday deadline.",
        "- The pricing decision unblocks Sara's pricing-page copy.",
        "",
        "## Open questions",
        "1. What happens if rate limiting slips past the 20th?",
        "2. Who signs off the release checklist Maya is writing?",
        "3. Is the $12 Pro price final, or does it need a last review?",
        "",
        "_Live Preview — pre-computed from the meeting transcript._"
      ].join("\n"),
      quiz: [
        {
          q: "What is the new Atlas launch date?",
          options: ["21 November", "25 November", "28 November", "1 December"],
          answer: 2,
          why: "Priya moved the launch to 28 November so onboarding can ship properly."
        },
        {
          q: "When is the hard code freeze?",
          options: ["20 November", "25 November", "28 November", "No freeze was set"],
          answer: 1,
          why: "Freeze on the 25th, three days before launch, no exceptions."
        },
        {
          q: "What happened to dark mode?",
          options: [
            "It ships in v1 as planned",
            "It was cut entirely",
            "It was deferred to v1.1",
            "It was replaced by a new theme"
          ],
          answer: 2,
          why: "Dark mode doubles design QA, so it ships in v1.1 instead."
        },
        {
          q: "What is the Pro price decided in the meeting?",
          options: ["$9 per month", "$12 per month", "$15 per month", "Free for launch"],
          answer: 1,
          why: "Pro is $12 per month; the free tier keeps 3 projects."
        },
        {
          q: "Who owns API rate limiting?",
          options: ["Priya", "Sara", "Maya", "Arjun"],
          answer: 3,
          why: "Rate limiting is Arjun's, and it is the top engineering priority."
        }
      ]
    }
  }
];

export function getPreset(id) {
  return PRESETS.find((p) => p.id === id) || null;
}
