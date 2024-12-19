$(document).ready(async function () {
    await boot()
    const simpleTable = {
        "bPaginate": false,
        "bLengthChange": false,
        "bFilter": false,
        "bInfo": false,
        order: [[1, 'desc']],
    }

    const logoCoumns = {columns:[
        {
            data: "name",
            render: function (data, type, row) {
                const imgUrl = appState.accountLogos[data] || "img/icon.webp";
                return `<div><img class="hide-on-mobile img-thumbnail" src="${imgUrl}" " style="width: 35px; height: 35px; object-fit: contain; padding: 0;"> ${data}</div>`;
            }
        },
        { data: "balance" },
        { data: "type" }
    ]}
    
    appState.stocksTable = $("#stocks-table").DataTable(simpleTable);
    appState.accountsTable = $("#accounts-table").DataTable({...simpleTable, ...logoCoumns});
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
