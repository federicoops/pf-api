$(document).ready(async function () {
    await boot()
    const simpleTable = {
        "bPaginate": false,
        "bLengthChange": false,
        "bFilter": false,
        "bInfo": false,
        "bAutoWidth": false,
        order: [[1, 'desc']]
    }
    
    appState.stocksTable = $("#stocks-table").DataTable(simpleTable);
    appState.accountsTable = $("#accounts-table").DataTable(simpleTable);
    UIManager.refresh()
    // Login form submission
    $("#login-form").on("submit", async function (e) {
        e.preventDefault();
        const username = $("#username").val();
        const password = $("#password").val();
        try {
            const loginResponse = await appState.apiClient.login(username, password);
            onLoginSuccess()
        } catch (error) {
            $("#login-feedback").html(`<div class="alert alert-danger">Login failed: ${error.message}</div>`);
        }
    });
});
