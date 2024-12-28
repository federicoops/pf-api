$(document).ready(async function () {
    await boot()

    function initializeYearSelector() {
        const currentYear = new Date().getFullYear();
        const yearSelector = $("#yearSelector");
    
        // Populate options for the last 3 years up to the current year
        for (let year = currentYear - 3; year <= currentYear; year++) {
            const selected = year === currentYear ? "selected" : "";
            yearSelector.append(
                `<option value="${year}" ${selected}>${year}</option>`,
            );
        }
    }

    function initializeMonthSelector() {
        const currentMonth = new Date().getMonth() + 1;
        const monthSelector = $("#monthSelector");
        monthSelector.val(currentMonth);
    }

    let transactionData = []
    async function fetchCategoryExpenses(currentYear, currentMonth) {
        $(".loaded").hide()
        transactionData = await appState.apiClient.getOverview(currentYear)
        $(".loaded").show()
        $(".loading").hide()


        // Transform data into a pivot table format
        const pivotData = {};
        const monthlyTotals = Array(12).fill(0);
        transactionData.forEach(({ _id, total }) => {
            if(_id.category == "Trasferimento" || _id.category == "Investimento") return;
            if(total > 0) return;
            if (!pivotData[_id.category]) pivotData[_id.category] = Array(12).fill(0);
            pivotData[_id.category][_id.month - 1] = total;
            
            // Update monthly totals
            monthlyTotals[_id.month - 1] += total;
        });

        // Add total row
        const tbody = $("#transactionsTable tbody");
        tbody.empty(); // Clear existing rows
        const totalRow = `<tr class="table-primary">
            <td><strong>Totale</strong></td>
            ${monthlyTotals.map(total => `<td class="text-right"><strong>${total.toFixed(2)+" €"}</strong></td>`).join('')}
        </tr>`;
        tbody.append(totalRow);

        // Populate table rows
        Object.entries(pivotData).forEach(([category, months]) => {
            // Update yearly table with category expense
            const row = `<tr>
                <td>${category}</td>
                ${months.map(amount => `<td class="text-right">${amount.toFixed(2)+" €" || 0}</td>`).join('')}
            </tr>`;
            tbody.append(row);
        });

        // Populate selected month table from pivot data selecting only the category expenses for the selected month
        const selectedMonthTable = $("#categoriesTable tbody");
        selectedMonthTable.empty(); // Clear existing rows

        // Add total row for the current month
        const currentMonthTotal = monthlyTotals[currentMonth - 1];
        const totalRowSelectedMonth = `<tr class="table-primary">
            <td><strong>Totale</strong></td>
            <td class="text-right"><strong>${currentMonthTotal.toFixed(2)+" €"}</strong></td>
        </tr>`;
        selectedMonthTable.append(totalRowSelectedMonth);

        Object.entries(pivotData).forEach(([category, months]) => {
            if(months[currentMonth - 1].toFixed(2) == 0) return;
            const row = `<tr>
                <td>${category}</td>
                <td class="text-right">${months[currentMonth - 1].toFixed(2)+" €" || 0}</td>
            </tr>`;
            selectedMonthTable.append(row);
        });


    }

    initializeYearSelector()
    initializeMonthSelector()
    const currentYear = $("#yearSelector").val()
    const currentMonth = $("#monthSelector").val()

    await fetchCategoryExpenses(currentYear, currentMonth)
    // Initialize DataTable
    $("#categoriesTable").DataTable({
        paging: false,
        searching: false,
        info: false,
        ordering: true,
        order: [[1, "asc"]]
    });

    // Initialize DataTable
    $("#transactionsTable").DataTable({
        paging: false,
        searching: false,
        info: false,
        ordering: false,
    });

    // Add action to load button to fetch data for the selected year and month
    $("#loadBalances").on("click", async function () {
        const currentYear = $("#yearSelector").val()
        const currentMonth = $("#monthSelector").val()
        await fetchCategoryExpenses(currentYear, currentMonth)
    });

    // Local Storage Keys
    const plannedExpensesKey = "plannedExpenses";
    const plannedIncomeKey = "plannedIncome";

    // Retrieve or initialize planned income and expenses from local storage
    const getPlannedExpenses = () => JSON.parse(localStorage.getItem(plannedExpensesKey)) || [];
    const savePlannedExpenses = (expenses) => localStorage.setItem(plannedExpensesKey, JSON.stringify(expenses));
    const getPlannedIncome = () => parseFloat(localStorage.getItem(plannedIncomeKey)) || 0;
    $("#plannedIncome").val(getPlannedIncome())
    const savePlannedIncome = (income) => localStorage.setItem(plannedIncomeKey, income);

    function isCurrentMonthExpense(transaction) {
        const currentMonth = new Date().getMonth() + 1; // Months are 0-indexed
        return (transaction['_id'].month === currentMonth) && 
            transaction.total < 0 && 
            !(transaction._id.category == "Trasferimento" || transaction._id.category == "Investimento")
    }

    function isCurrentMonthIncome(transaction) {
        const currentMonth = new Date().getMonth() + 1; // Months are 0-indexed
        return (transaction['_id'].month === currentMonth) && 
            transaction.total > 0 && 
            !(transaction._id.category == "Trasferimento" || transaction._id.category == "Investimento")
    }

    // Function to get the total actual expenses/incomes for the current month
    const getActualTotalForCurrentMonth = (filter) => {
        const currentMonth = new Date().getMonth() + 1; // Months are 0-indexed
        return transactionData
            .filter(transaction => filter(transaction))
            .reduce((sum, transaction) => sum + transaction.total, 0);
    };

    // Function to calculate and update net savings
    const updateNetSavings = () => {
        const plannedExpenses = getPlannedExpenses().filter(e => e.enabled).reduce((sum, expense) => sum + expense.amount, 0);
        const actualExpenses = getActualTotalForCurrentMonth(isCurrentMonthExpense);
        const actualIncomes = getActualTotalForCurrentMonth(isCurrentMonthIncome);
        const plannedIncome = getPlannedIncome();
        const totalExpenses = -(-plannedExpenses+actualExpenses)
        const totalIncomes = plannedIncome+actualIncomes
        const netSavings = totalIncomes - (totalExpenses);
        $("#netSavingsAmount").text(netSavings.toFixed(2)+" €");
        $("#totalExpenses").text(totalExpenses.toFixed(2)+" €");
        $("#totalIncomes").text(totalIncomes.toFixed(2)+" €")
    };

    // Function to populate the planned expenses table
    const loadPlannedExpensesTable = () => {
        const tbody = $("#plannedExpensesTable tbody");
        tbody.empty(); // Clear existing rows
        const expenses = getPlannedExpenses();

        expenses.forEach((expense, index) => {
            const row = `<tr>
                <td>${expense.category}</td>
                <td class="text-right">${expense.amount.toFixed(2)+ " €"}</td>
                <td>
                    <button class="btn btn-danger btn-sm delete-expense" data-index="${index}">Delete</button>
                    <input class="form-check-input enable-recurrent" type="checkbox"  data-index="${index}" ${(expense.enabled)?'checked':''}>
                </td>
            </tr>`;
            tbody.append(row);
        });

        // Attach delete handlers
        $(".delete-expense").on("click", function () {
            const index = $(this).data("index");
            deletePlannedExpense(index);
            updateNetSavings();
        });

        // Attach delete handlers
        $(".enable-recurrent").on("click", function () {
            const index = $(this).data("index");
            
            const expenses = getPlannedExpenses()
            expenses[index].enabled = $(this).prop('checked')
            savePlannedExpenses(expenses);
            updateNetSavings();
        });

        // Update net savings
        updateNetSavings();
    };

    // Function to delete a planned expense by index
    const deletePlannedExpense = (index) => {
        const expenses = getPlannedExpenses();
        expenses.splice(index, 1);
        savePlannedExpenses(expenses);
        loadPlannedExpensesTable();
    };

    // Expense form submission handler
    $("#expenseForm").on("submit", function (e) {
        e.preventDefault();
        const category = $("#category").val();
        const amount = parseFloat($("#amount").val());

        const newExpense = { category, amount };
        const expenses = getPlannedExpenses();
        expenses.push(newExpense);
        savePlannedExpenses(expenses);

        // Reset form and refresh table
        this.reset();
        loadPlannedExpensesTable();
    });

    // Income form submission handler
    $("#incomeForm").on("submit", function (e) {
        e.preventDefault();
        const income = parseFloat($("#plannedIncome").val());

        savePlannedIncome(income);
        updateNetSavings();
    });

    // Load planned expenses and update net savings
    loadPlannedExpensesTable();
    updateNetSavings();
});