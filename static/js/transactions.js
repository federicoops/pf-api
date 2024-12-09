$(document).ready(async function () {

    await boot();

    async function onTransactionFetched(transactions) {
        // Clear existing data in DataTable
        $.transactionsTable.clear();

        // Populate table
        transactions.forEach((transaction) => {
            appState.transactions[transaction._id] = transaction;
            let account = appState.accounts[transaction.account];
            if(account == undefined) account = {'name': 'conto eliminato'}
            const date = new Date(transaction.date);
            $.transactionsTable.row.add({
            id: transaction._id,
            amount: `${transaction.amount} €`,
            date: date.toISOString().split("T")[0],
            category: transaction.category,
            account: account.name,
            accountid: transaction.account,
            description: transaction.description || "N/A",
            });
        });

        // Redraw the table
        $.transactionsTable.draw();
    }

    async function onFilterClicked(start_date = null, end_date = null) {
        if (!start_date) start_date = Utils.getStartOfTime();
        if (!end_date) end_date = Utils.getToday();
        console.log(start_date, end_date);
        const transactions = await appState.apiClient.listTransactions(start_date, end_date);
        onTransactionFetched(transactions);
    }

    $.transactionsTable = $("#transactions-table").DataTable({
        columns: [
            { data: "id", visible: false }, // Hidden ID column
            { data: "amount" },
            { data: "date" },
            { data: "category" },
            { data: "account" },
            { data: "accountid", visible: false }, // Hidden ID column
            { data: "description" },
            {
                data: null,
                render: function (data) {
                    return `
                    <button class="btn btn-warning btn-sm edit-btn">Modifica</button>
                    <button class="btn btn-danger btn-sm delete-btn">Elimina</button>
                `;
                },
            },
        ],
        order: [[2, "desc"]],
    });

    await onFilterClicked();

    // Handle delete
    $("#transactions-table tbody").on(
        "click",
        ".delete-btn",
        async function () {
            const row = $.transactionsTable.row(
                $(this).closest("tr"),
            );
            const rowData = row.data();
            const id = rowData.id; // Retrieve ID from hidden column
            if (
                confirm(
                    `Sei sicuro di voler eliminare la transazione con importo ${rowData.amount}?`,
                )
            ) {
                try {
                    await appState.apiClient.deleteTransaction(id);
                } catch (error) {
                    alert(error.message);
                }
                row.remove().draw();
            }
        },
    );

    // List transactions
    $("#list-transactions").on("click", async function () {
        try {
            let start_date = $("#tr-start").val();
            let end_date = $("#tr-end").val();
            onFilterClicked(start_date, end_date);
        } catch (error) {
            alert(`Failed to fetch transactions: ${error.message}`);
        }
    });

    // Handle edit button click
    $("#transactions-table tbody").on(
        "click",
        ".edit-btn",
        function () {
            const row = $(this).closest("tr");
            const rowData = $.transactionsTable.row(row).data();
            UIManager.populateDropdown("#edit-conto", appState.accounts, "Seleziona conto");
            // Fill modal with row data
            $("#edit-id").val(rowData.id);
            $("#edit-importo").val(
                parseFloat(rowData.amount.replace("€", "")),
            );
            $("#edit-data").val(rowData.date);
            $("#edit-categoria").val(rowData.category);
            $("#edit-conto").val(rowData.accountid).change();
            $("#edit-descrizione").val(rowData.description);
            // Show modal
            const editModal = new bootstrap.Modal(
                document.getElementById("editModal"),
            );
            editModal.show();
        },
    );

    // Handle save edit
    $("#saveEdit").on("click", async function () {
        const editModal = bootstrap.Modal.getInstance(
            document.getElementById("editModal"),
        );
        const id = $("#edit-id").val(); // Hidden ID from the modal
        let date = new Date($("#edit-data").val());
        date.setDate(date.getDate() + 1);
        const updatedData = {
            amount: $("#edit-importo").val(),
            date: date,
            category: $("#edit-categoria").val(),
            account: $("#edit-conto :selected").val(),
            description: $("#edit-descrizione").val(),
        };
        // Update in db
        try {
            await appState.apiClient.updateTransaction(id, updatedData);
        } catch (error) {
            alert(error.message);
            editModal.hide();
            return;
        }
        updatedData.id = id;
        updatedData.accountid = $("#edit-conto :selected").val();
        updatedData.account = $("#edit-conto :selected").text();
        date.setDate(date.getDate() - 1);
        updatedData.date = date.toISOString().split("T")[0];
        // Update the corresponding row data
        $.transactionsTable.rows().every(function () {
            const rowData = this.data();
            if (rowData.id == id) {
                this.data(updatedData).draw(); // Update and redraw the row
            }
        });

        // Hide the modal
        editModal.hide();
    });

    $("#backup").on("click", async function () {
        csvContent = await appState.apiClient.dump();

        // Create a Blob from the CSV content
        const blob = new Blob([csvContent], { type: "text/csv" });

        // Create a URL for the Blob
        const url = window.URL.createObjectURL(blob);

        // Create a temporary anchor element to trigger the download
        const a = document.createElement("a");
        a.href = url;
        a.download = "transactions.csv"; // File name
        document.body.appendChild(a);
        a.click();

        // Clean up by revoking the Blob URL and removing the anchor
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    });
});