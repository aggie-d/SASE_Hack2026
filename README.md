# LAD Transfer

## Devpost Link
https://devpost.com/software/1435244/joins/CZ8OF6byHyxB46CdRptdYQ

## Figma Link
https://www.figma.com/design/o0G7GSfx08dRRVCV4s8QuZ/SASEHack?node-id=0-1&t=9K78YISFETSsfSJf-1

Lanre Ladejobi, Thembi Loga, Deryck Assenga, Agronil Das

_Connecting local earnings to global opportunity._

**Being able to afford something should mean being able to pay for it.**

For Malawians trying to access international goods and services, that connection can break down. A student may have saved enough for an online course. A freelancer may have earned enough to purchase essential software. Yet paying internationally can remain difficult when their money is held in Malawian kwacha (MWK) and foreign currency is scarce.

**ladTransfer is a digital wallet prototype designed to help Malawians turn locally earned money into international purchasing power.** It brings deposits, currency conversion, wallet balances, and virtual card spending into one guided experience, with clear costs and transaction statuses at every step.

We integrated directly with [**Lithic’s APIs**](https://www.lithic.com/) to power the prototype’s virtual card issuing and card payment functionality. This connects our simulated USDT wallet experience to a working card infrastructure sandbox, demonstrating how users could move from a local currency balance to international card spending.

## Inspiration

ladTransfer was inspired by a frustrating reality: having enough money in Malawi does not always mean being able to pay.

Malawi imports substantially more than it exports, meaning its export earnings do not generate enough foreign currency to cover its import needs. This imbalance contributes to persistent forex shortages, alongside other economic pressures. The shortage affects access to essential imports and the ability of people and businesses to transact internationally. [Background on Malawi’s forex shortage](https://www.reuters.com/world/africa/malawi-aims-bring-inflation-below-21-this-year-president-says-2026-02-13/).

With foreign currency scarce, banks tightly manage forex allocations. Customers can face application requirements, delays, limited allocations, or unsuccessful requests—even when they have sufficient funds in Malawian kwacha. International card spending can also be restricted, leaving people uncertain about whether they will be able to pay online or access spending money abroad.

The consequences are practical and personal. A student may be unable to pay for an online course. A freelancer may struggle to renew essential software. A family may be unable to purchase products from an international website. A traveler may have money at home but insufficient spending capacity on their card. Businesses can struggle to pay overseas suppliers, delaying stock, equipment, and operations.

These barriers inspired us to build ladTransfer: a prototype exploring how locally earned money could become more accessible for international spending. Our proposed journey connects MWK deposits, conversion into a USDT balance, and virtual card payments through our Lithic API integration.

The prototype explores an additional payment route where partner liquidity is available. Its purpose is to give people a clearer, more convenient way to access global goods and services.

Our inspiration is simple: the money people work hard to earn should help them access opportunities beyond their borders.

## How it works

Our prototype models a straightforward payment journey:

1. **Add money.** Simulate depositing MWK through mobile money or a bank transfer, and follow the deposit from pending to confirmed.
2. **Review and convert.** See the exchange rate, fee, amount to be received, and quote expiry before converting MWK into a simulated USDT balance. USDT is a digital token designed to track the US dollar.
3. **Fund and pay.** Allocate USDT to a virtual demo card and complete a simulated international purchase, with wallet and card balances shown separately.

In the proposed live service, liquidity partners would supply the USDT, while a card partner would handle conversion and settlement with merchants. This would give users a familiar way to pay while keeping the underlying funding process visible.

## Challenges we ran into

The worst hurdle for us as a team was definitely the experience gap between some of our members, and getting those who weren’t as acquainted with Git and languages up to date and ready to work. Additionally, getting each teammate’s work to fit together required consistent amounts, balances, and payment statuses across the app alongside proficient Git usage from everyone, including people who had barely even used it before. We also had to keep conversion calculations accurate, handle payments that remained pending, and build safeguards against counting the same confirmation twice.

## Accomplishments that we’re proud of

We’ve turned a very broad and serious financial access problem into a focused prototype with deposits, conversion quotes, and virtual card spending. We’re especially proud of showing costs before confirmation and keeping wallet funds separate from card funds, helping users truly understand what they have and what they can spend. We’re also very proud of the level of proficiency and teamwork we’ve come to develop overall, as though we may have started as 4 individuals on very different levels, we’ve come to function as one like-minded group.

## What we learned

We learned that a payment button is only one small part of a financial product. The harder work is tracking what happens afterward and explaining it clearly. There truly was so much under the surface of transactions that none of us ever really thought about, so creating everything from scratch was honestly a really big wake-up call in terms of all the little things that go into making transactions happen. We also learned to design around limited currency availability, since a useful interface still depends on partners who can supply and move funds.

## What’s next for ladTransfer

We’ll test that every part works together, including when payments fail, arrive late, or receive repeated confirmations. Then we’ll gather feedback from Malawian students and business owners. Moving beyond the demo will require dependable collection, currency conversion, and card partners, along with the necessary approvals.

## Social Impact: access for a specific community

The hackathon’s Social Impact track asks who a project serves and why existing options fall short. Our focus is Malawians who earn and hold MWK but face barriers when paying international providers. A domestic balance alone cannot guarantee access to foreign currency or a supported international payment method.

That obstacle can affect access to education, professional tools, and business services. ladTransfer explores a practical additional payment route for these users, while presenting each step in language that people unfamiliar with cryptocurrency can follow.

The intended benefit is concrete: helping a learner pay for a course, a freelancer obtain a tool, or a business access a service. Testing these journeys with local users is essential to understanding whether the design addresses their actual needs.

## Finance: clearer decisions before money moves

The Finance track emphasizes making financial decisions easier or clearer. ladTransfer organizes the experience around the decisions a user needs to make: how much MWK to commit, what the conversion costs, how much USDT they will receive, and how much to allocate to card spending.

Showing these details before confirmation helps users assess a transaction. Separating wallet and card balances helps them understand where their funds are allocated. Clear pending, completed, and failed states help explain what has happened to a payment.

The backend design supports this clarity through a transaction ledger, exact integer arithmetic for monetary calculations, and checks for expired quotes, insufficient funds, and unavailable liquidity. Duplicate-event safeguards are designed to prevent repeated payment confirmations from creating additional credits.

## Card infrastructure powered by Lithic

**Lithic powers the card issuing and processing layer behind our proposed stablecoin spending experience.** Its infrastructure supports connecting an external wallet or stablecoin ledger to card authorization and spending controls. [Learn more about Lithic’s stablecoin card infrastructure](https://www.lithic.com/solutions/stablecoin).

Our API integration lets us demonstrate the card side of this journey in Lithic’s sandbox while keeping MWK deposits and USDT conversion simulated. Together, these components show how a wallet balance could become usable through a familiar payment method: a virtual card.

## Built around clarity and trust (and How We Built It)

For someone unfamiliar with cryptocurrency, understanding what their balance represents matters. **USDT is a stablecoin designed to maintain a value of approximately US$1 per token.** According to its issuer, Tether, USDT is fully backed by reserves that include traditional currency, cash equivalents, and other assets. This backing supports its dollar peg. [Read Tether’s explanation of USDT and its reserves](https://tether.to/en/faqs/).

**ladTransfer is designed to offer the familiar experience of a dollar-linked wallet:** users can understand their balance in dollar terms and allocate funds for international purchases. The underlying balance is held in USDT, however, rather than US dollars in a bank account.

The experience centers on practical questions: How much am I depositing? What will conversion cost? How much can I spend? Has my payment completed? Clear quotes, visible fees, and transaction statuses help users make informed decisions at each step.

The project uses **Next.js, TypeScript, and Supabase/PostgreSQL**, alongside our **Lithic API integration** for virtual card testing in a sandbox environment. Its responsive design **adapts to phones, tablets, and desktops**, giving users access to the same payment tools across devices. Next.js brings the interface and payment services together, TypeScript helps catch coding errors early, and Supabase/PostgreSQL supports sign-in and stores account and transaction records between sessions. Behind the interface, a **transaction ledger** records balance changes, while **exact integer arithmetic** uses whole-number calculations to keep monetary amounts precise. Safeguards address duplicate payment events, expired quotes, and insufficient funds, helping prevent repeated credits and invalid transactions. Together, these choices make every balance change easier to trace, verify, and understand.

**Our hackathon demonstration combines simulated deposits and conversion liquidity with Lithic sandbox cards and test transactions. No real funds move during the demo.**

## Why it matters

Our goal is to make education, software, and international commerce more accessible to people earning in MWK. A successful payment could help someone continue learning, deliver a client project, or obtain a tool their business needs.

Taking ladTransfer live would require dependable liquidity, collection and card partners, appropriate regulatory approvals, and validation with local users. Malawi’s foreign exchange shortage remains a real constraint; our contribution is a proposed additional payment route when partner liquidity is available.

**ladTransfer’s ambition is simple: help people turn the money they earn into opportunities they can actually access.**