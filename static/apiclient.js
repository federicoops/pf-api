class ApiClient {
    constructor(baseURL) {
        this.baseURL = baseURL;
        this.accessToken = window.localStorage.getItem('token') ;
    }


    async isLogged() {
        return this.accessToken != null;
    }

    // Helper method to make API requests
    async request(endpoint, method = "GET", data = null, params = {}) {
        const url = new URL(this.baseURL + endpoint);

        // Add query parameters if provided
        Object.keys(params).forEach((key) => {
            if (params[key] !== undefined) {
                url.searchParams.append(key, params[key]);
            }
        });


        const headers = {
            "Content-Type": "application/json",
        };

        if (this.accessToken) {
            headers["Authorization"] = `Bearer ${this.accessToken}`;
        }

        const options = {
            method,
            headers,
        };


        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        if(response.status == 204) return {} // http 204 no content
        return response.json();
    }

    // Authentication: Login to get an access token
    async login(username, password) {
        const data = new URLSearchParams({
            username,
            password,
            grant_type: "password",
        });

        const response = await fetch(this.baseURL + "/api/auth", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: data,
        });

        if (!response.ok) {
            throw new Error("Login failed");
        }
        const result = await response.json();
        this.accessToken = result.access_token;
        window.localStorage.setItem('token', this.accessToken)
        return result;
    }

    // Transactions
    async listTransactions(startDate, endDate) {
        return this.request("/api/transactions/", "GET", null, { start_date: startDate, end_date: endDate });
    }

    async addTransaction(transactionData) {
        return this.request("/api/transactions/", "POST", transactionData);
    }

    async findTransaction(id) {
        return this.request(`/api/transactions/${id}`, "GET");
    }

    async updateTransaction(id, transactionData) {
        return this.request(`/api/transactions/${id}`, "PUT", transactionData);
    }

    async deleteTransaction(id) {
        return this.request(`/api/transactions/${id}`, "DELETE");
    }

    async aggregateTransactions(startDate, endDate, aggregateType) {
        return this.request("/api/transactions/aggregate", "GET", null, {
            start_date: startDate,
            end_date: endDate,
            aggregate: aggregateType,
        });
    }

    // Accounts
    async listAccounts() {
        return this.request("/api/accounts/", "GET");
    }

    async addAccount(accountData) {
        return this.request("/api/accounts/", "POST", accountData);
    }

    async findAccount(id) {
        return this.request(`/api/accounts/${id}`, "GET");
    }

    async updateAccount(id, accountData) {
        return this.request(`/api/accounts/${id}`, "PUT", accountData);
    }

    async deleteAccount(id) {
        return this.request(`/api/accounts/${id}`, "DELETE");
    }

    async findAccountTransactions(id) {
        return this.request(`/api/accounts/${id}/transactions`, "GET");
    }

    // Tickers
    async getTickerPrice(ticker) {
        return this.request(`/api/tickers/${ticker}`, "GET");
    }

    // Users
    async getMe() {
        return this.request("/api/auth/me", "GET");
    }
}
