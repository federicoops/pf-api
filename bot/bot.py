from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, CallbackQueryHandler, filters, ContextTypes
import requests
from datetime import date, time, datetime
import os
from dotenv import load_dotenv
import json
from apiClient import ApiClient
# Load environment variables from .bot.env
load_dotenv(".bot.env")

# Set up API and Telegram credentials
API_BASE_URL = os.getenv("API_BASE_URL")
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
ALLOWED_TELEGRAM_ID = int(os.getenv("ALLOWED_TELEGRAM_ID"))

# States for conversation
STATE_AMOUNT = 1
STATE_CATEGORY = 2
STATE_ACCOUNT = 3
STATE_DESCRIPTION = 4

# Dictionary to store user transactions
temp_transaction = {}

client: ApiClient = ApiClient(API_BASE_URL)

# Authenticate with the remote API
def authenticate_with_api():
    username = os.getenv("API_USERNAME")
    password = os.getenv("API_PASSWORD")

    if not username or not password:
        raise ValueError("API_USERNAME and API_PASSWORD must be set in the environment.")

    client.login(username, password)

try:
    authenticate_with_api()
except:
    raise ConnectionError("Could not establish a connection to the API.")



async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ALLOWED_TELEGRAM_ID:
        await update.message.reply_text("Unauthorized user.")
        return

    await update.message.reply_text("Welcome to your personal finance bot! Send the transaction amount to start adding a transaction.")

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ALLOWED_TELEGRAM_ID:
        await update.message.reply_text("Unauthorized user.")
        return

    user_id = update.effective_user.id

    # Check if the user is starting a new transaction by entering an amount
    try:
        amount = float(update.message.text)
        temp_transaction[user_id] = {'amount': amount}

        # Fetch categories from API
        response = client.aggregate_transactions(date.min, date.today(), "category")
        categories = response
        keyboard = [[InlineKeyboardButton(cat['_id'], callback_data=f"{cat['_id']}")] for cat in categories]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text("Select a category:", reply_markup=reply_markup)
        return STATE_CATEGORY
    except ValueError:
        await update.message.reply_text("Invalid input. Please send a valid transaction amount to start.")

async def handle_category(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    user_id = update.effective_user.id
    category_id = query.data
    temp_transaction[user_id]['category'] = category_id

    # Fetch accounts from API
    response = client.list_accounts()
    accounts = response

    keyboard = [[InlineKeyboardButton(acc['name'], callback_data=f"{acc['_id']}")] for acc in accounts]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await query.edit_message_text("Select an account:", reply_markup=reply_markup)
    return STATE_ACCOUNT

async def handle_account(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    user_id = update.effective_user.id
    account_id = query.data
    temp_transaction[user_id]['account'] = account_id

    await query.edit_message_text("Provide a description")
    return STATE_DESCRIPTION

async def handle_description(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    description = update.message.text
    temp_transaction[user_id]['description'] = description

    await submit_transaction(update, context)

async def skip_description(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await submit_transaction(update, context)

async def submit_transaction(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    transaction = temp_transaction.pop(user_id, {})
    # Submit the transaction to the API
    response = client.add_transaction(transaction)
    
    if "_id" in response:
        await update.message.reply_text("Transaction added successfully!")
    else:
        await update.message.reply_text("Failed to add transaction. Please try again later.")

    return ConversationHandler.END

# Main application setup
if __name__ == "__main__":
    from telegram.ext import ConversationHandler

    application = ApplicationBuilder().token(TELEGRAM_TOKEN).build()

    conv_handler = ConversationHandler(
        entry_points=[MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message)],
        states={
            STATE_CATEGORY: [CallbackQueryHandler(handle_category)],
            STATE_ACCOUNT: [CallbackQueryHandler(handle_account)],
            STATE_DESCRIPTION: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_description),
                                CommandHandler("skip", skip_description)],
        },
        fallbacks=[CommandHandler("start", start)]
    )

    application.add_handler(CommandHandler("start", start))
    application.add_handler(conv_handler)

    application.run_polling()
