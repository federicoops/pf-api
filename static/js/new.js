
function updateAmountInv() {
    price = $("#investment-price").val()
    quantity = $("#investment-quantity").val()
    fee = parseFloat($("#investment-fee").val())
    if(isNaN(fee)) fee = 0
    total = price*quantity + fee
    $("#investment-amount").val(total)
}        

function updatePrice() {
    console.log("called")
    appState.apiClient.getTickerPrice($("#investment-ticker").val()).then(response => {
        $("#investment-price").val(response.price.toFixed(2))
    })
}



$(document).ready(async function () {
    await boot()

    // Get today's date in the format 'YYYY-MM-DD'
    const today = new Date().toISOString().split('T')[0];

    // Set the value of all date inputs to today's date
    $('input[type="date"]').val(today);
    UIManager.populateDropdown("#basic-account", appState.accounts, "Seleziona conto");
    UIManager.populateDropdown("#investment-account", appState.accounts, "Seleziona conto");
    UIManager.populateDropdown("#transfer-to-account", appState.accounts, "Seleziona conto");
    UIManager.populateDropdown("#transfer-from-account", appState.accounts, "Seleziona conto");
    UIManager.populateDropdown(".form-category", appState.categories, "Seleziona categoria")

    // Basic Transaction form submission
    $("#basic-transaction-form").on("submit", async function (e) {
        e.preventDefault();
        let btn = $(this).closest('form').find(':submit');
        btn.text("...")
        let date = new Date($("#basic-date").val());
        date.setDate(date.getDate() + 1);
        const data = {
            date: date,
            category: $("#basic-category").val(),
            amount: $("#basic-amount").val(),
            account: $("#basic-account :selected").val(),
            description: $("#basic-description").val()
        };
        try {
            await appState.apiClient.addTransaction(data)
            displaySuccess(btn)
        } catch (error) {
            alert(error.message)
        }

    });

    // Investment Transaction form submission
    $("#investment-transaction-form").on("submit", async function (e) {
        e.preventDefault();
        let btn = $(this).closest('form').find(':submit');
        btn.text("...")
        let date = new Date($("#investment-date").val());
        date.setDate(date.getDate() + 1);
        const buy = {
            date: date,
            category: "Investimento",
            amount: $("#investment-amount").val(),
            account: $("#investment-account").val(),
            ticker: $("#investment-ticker").val(),
            quantity: $("#investment-quantity").val(),
            price: $("#investment-price").val(),
            description: $("#investment-description").val()
        };

        const liquidity = {
            date: date,
            category: "Investimento",
            amount: -$("#investment-amount").val(),
            description: $("#investment-description").val(),
            account: $("#investment-account").val(),
        }

        try {
            await appState.apiClient.addTransaction(buy)
            await appState.apiClient.addTransaction(liquidity)
            displaySuccess(btn)
        } catch (error) {
            alert(error.message)
        }
    });

    
    function displaySuccess(btn) {
        btn.text("OK")
        btn.toggleClass("btn-primary")
        btn.toggleClass("btn-success")
        btn.attr('disabled', true);

        setTimeout(function() { 
            btn.text('Aggiungi');
            btn.attr('disabled', false);
            btn.toggleClass("btn-primary")
            btn.toggleClass("btn-success")
        }, 2000);
    }
    

    // Transfer Transaction form submission
    $("#transfer-transaction-form").on("submit",async function (e) {
        e.preventDefault();
        let btn = $(this).closest('form').find(':submit');
        btn.text("...")
        let date = new Date($("#transfer-date").val());
        date.setDate(date.getDate() + 1);
        const from = {
            date: date,
            category: "Trasferimento",
            amount: -$("#transfer-amount").val(),
            account: $("#transfer-from-account :selected").val(),
            description: $("#transfer-description").val()
        };
        const to = {
            date: date,
            category: "Trasferimento",
            amount: $("#transfer-amount").val(),
            account: $("#transfer-to-account :selected").val(),
            description: $("#transfer-description").val()
        };

        try {
            await appState.apiClient.addTransaction(from)
            await appState.apiClient.addTransaction(to)
            displaySuccess(btn)
        } catch (error) {
            alert(error.message)
        }
    });
});
