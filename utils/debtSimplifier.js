/**
 * Minimizes the number of transactions required to settle debts.
 * Uses a greedy algorithm (similar to Splitwise) to match highest debtors with highest creditors.
 */
function simplifyDebts(balances) {
    // 1. Separate into debtors (owe money) and creditors (owed money)
    let debtors = [];
    let creditors = [];

    for (const [person, amount] of Object.entries(balances)) {
        if (amount < -0.01) debtors.push({ person, amount });
        if (amount > 0.01) creditors.push({ person, amount });
    }

    // 2. Sort by amount magnitude (Greedy approach)
    debtors.sort((a, b) => a.amount - b.amount); // Ascending (most negative first)
    creditors.sort((a, b) => b.amount - a.amount); // Descending (most positive first)

    const settlements = [];
    let i = 0; // debtor index
    let j = 0; // creditor index

    // 3. Match them
    while (i < debtors.length && j < creditors.length) {
        let debtor = debtors[i];
        let creditor = creditors[j];

        // The amount to settle is the minimum of what's owed vs what's needed
        // We use Math.min of absolute values
        let amount = Math.min(Math.abs(debtor.amount), creditor.amount);
        
        // Round to 2 decimals
        amount = Math.round(amount * 100) / 100;

        settlements.push({
            from: debtor.person,
            to: creditor.person,
            amount: amount,
            currency: "USD" // Simplified for base reporting
        });

        // Update balances
        debtor.amount += amount;
        creditor.amount -= amount;

        // If settled, move to next person
        if (Math.abs(debtor.amount) < 0.01) i++;
        if (creditor.amount < 0.01) j++;
    }

    return settlements;
}

module.exports = { simplifyDebts };