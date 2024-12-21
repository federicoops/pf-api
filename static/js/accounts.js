$(document).ready(async function () {
    await boot();
        
    // Initialize DataTable
    let accountsTable = $("#accounts-page-table").DataTable({
        columns: [
            { data: "id", visible: false},
            { data: "name" },
            { data: "balance" },
            { data: "info"}, 
            { data: "type" },
            { 
            data: null,
            orderable: false,
            render: function (data, type, row) {
                return `
                <button class="btn btn-warning btn-sm edit-btn" data-id="${row.id}">Modifica</button>
                <button class="btn btn-danger btn-sm delete-btn" data-id="${row.id}">Elimina</button>
                `;
            },
            },
        ],
        paging: false,
        searching: false,
        info: false,
        ordering: false
    });

    // Load accounts into the DataTable
    async function loadAccounts() {
        try {
            const accounts = await appState.apiClient.listAccounts();
            accountsTable.clear();
            accounts.forEach(account => {
                let total = appState.accounts[account._id].total
                if(!total) total = 0
                accountsTable.row.add({
                    id: account._id,
                    name: account.name,
                    type: appState.accountTypesFormat[account.asset_type].name,
                    info: account.info,
                    balance: total.toFixed(2)+" €"
                });                    
            });

            accountsTable.draw();
        } catch (error) {
            console.error("Error loading accounts:", error);
        }
    }

    
    // Initialize the page by loading accounts
    await loadAccounts();
    UIManager.populateDropdown("#accountType", appState.accountTypesFormat, "Seleziona tipologia")
    UIManager.populateDropdown("#editAccountType", appState.accountTypesFormat, "Seleziona tipologia")

    // Handle create account
    $("#createAccountForm").on("submit", async function (event) {
        event.preventDefault();
        const name = $("#accountName").val();
        const asset_type = $("#accountType").val();
        const balance = $("#accountBalance").val();

        try {
            const res = await appState.apiClient.addAccount({name, asset_type});
            const inserted_id = res._id
            const data = {
                date: new Date(),
                category: "Trasferimento",
                amount: balance,
                account: inserted_id,
                description: `Apertura ${name}`
            };
            let tr = await appState.apiClient.addTransaction(data)
            console.log(tr)
            $("#createAccountForm")[0].reset();
            $("#createAccountModal").modal("hide")

        } catch (error) {
            console.error("Error creating account:", error);
            $("#createAccountModal").modal("hide")
        }
        AccountManager.refreshAccounts().then(()=> loadAccounts())
    });

    // Handle edit button click
    $("#accounts-page-table").on("click", ".edit-btn", async function () {
        const id = $(this).data("id");
        console.log(`clicked edit on {id}`)
        const row = accountsTable.row($(this).closest("tr"));
        const rowData = row.data();
        $("#editAccountId").val(rowData.id);
        $("#editAccountName").val(rowData.name);
        $("#editAccountType").val(rowData.type);
        $("#editAccountInfo").val(rowData.info);
        $("#editAccountModal").modal("show");
    });

    // Handle update account
    $("#editAccountForm").on("submit", async function (event) {
        event.preventDefault();
        const id = $("#editAccountId").val();
        const name = $("#editAccountName").val();
        const asset_type = $("#editAccountType").val();
        const info = $("#editAccountInfo").val()
        try {
            await appState.apiClient.updateAccount(id, { name, asset_type, info });
            $("#editAccountModal").modal("hide");
            await loadAccounts();
        } catch (error) {
            console.error("Error updating account:", error);
        }
    });

    // Handle delete button click
    $("#accounts-page-table").on("click", ".delete-btn", async function () {
    const id = $(this).data("id");
    if (confirm("Sei sicuro di voler eliminare questo conto?")) {
        try {
            await appState.apiClient.deleteAccount(id);
            AccountManager.refreshAccounts().then(()=> loadAccounts())
        } catch (error) {
            console.error("Error deleting account:", error);
        }
    }
    });

});