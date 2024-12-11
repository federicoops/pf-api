import requests
import json
from urllib.parse import urlencode

class ApiClient:

    def __init__(self, base_url):
        self.base_url = base_url
        self.access_token = None

    def is_logged(self):
        return self.access_token is not None

    def request(self, endpoint, method="GET", data=None, params=None, raw=False):
        url = f"{self.base_url}{endpoint}"
        if params:
            url += f"?{urlencode(params)}"

        headers = {"Content-Type": "application/json"}
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"

        response = requests.request(
            method,
            url,
            headers=headers,
            data=json.dumps(data) if data else None
        )

        if not response.ok:
            raise Exception(f"Error {response.status_code}: {response.reason}")

        if response.status_code == 204:
            return {}
        return response.text if raw else response.json()

    def login(self, username, password):
        data = {
            "username": username,
            "password": password,
            "grant_type": "password"
        }
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        response = requests.post(f"{self.base_url}/api/auth/", headers=headers, data=urlencode(data))

        if not response.ok:
            raise Exception("Login failed")

        result = response.json()
        self.access_token = result["access_token"]
        return result

    def add_transaction(self, transaction_data):
        return self.request("/api/transactions/", "POST", data=transaction_data)

    def aggregate_transactions(self, start_date, end_date, aggregate_type):
        return self.request("/api/transactions/aggregate", "GET", params={"start_date": start_date, "end_date": end_date, "aggregate": aggregate_type})

    def list_accounts(self):
        return self.request("/api/accounts/", "GET")

