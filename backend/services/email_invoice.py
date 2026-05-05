import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_EMAIL = os.environ.get("SMTP_EMAIL", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "")
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587

def _send(to_email: str, subject: str, html: str):
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"[EMAIL-INV] SMTP not configured, skipping email to {to_email}")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"Careable 360+ <{SMTP_EMAIL}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        print(f"[EMAIL-INV] Sent to {to_email}: {subject}")
        return True
    except Exception as e:
        print(f"[EMAIL-INV] Failed to send to {to_email}: {e}")
        return False

def _base_html(body_content: str) -> str:
    return f"""<html><body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#f3f4f6">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
<tr><td style="background:linear-gradient(135deg,#059669,#047857);padding:32px;text-align:center">
<h1 style="color:white;margin:0;font-size:28px">Careable 360+</h1>
<p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Healthcare Solutions</p></td></tr>
<tr><td style="padding:32px">{body_content}</td></tr>
<tr><td style="padding:16px 32px;background:#f9fafb;text-align:center;font-size:12px;color:#9ca3af">
This is an automated message from Careable 360+. Please do not reply directly.</td></tr>
</table></body></html>"""

def _items_table(line_items: list) -> str:
    rows = ""
    for i, item in enumerate(line_items):
        bg = "#f9fafb" if i % 2 == 0 else "#ffffff"
        rows += f"""<tr style="background:{bg}">
<td style="padding:12px;border-bottom:1px solid #f3f4f6">{item.get('name','')}</td>
<td style="padding:12px;border-bottom:1px solid #f3f4f6;text-align:center">{item.get('quantity',1)}</td>
<td style="padding:12px;border-bottom:1px solid #f3f4f6;text-align:right">Rs.{item.get('item_total',0):.2f}</td></tr>"""
    return f"""<table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
<tr style="background:#f3f4f6"><th style="padding:12px;text-align:left;font-size:13px">Item</th>
<th style="padding:12px;text-align:center;font-size:13px">Qty</th>
<th style="padding:12px;text-align:right;font-size:13px">Amount</th></tr>{rows}</table>"""

def send_payment_confirmation_to_customer(invoice: dict):
    customer = invoice.get("customer_details", {})
    email = customer.get("email")
    if not email:
        return False
    method = invoice.get("payment_method", "online")
    method_label = "Cash on Delivery" if method == "cod" else "Online Payment"
    method_note = "Please keep the exact amount ready at the time of delivery." if method == "cod" else "Your payment has been processed successfully."
    body = f"""<h2 style="color:#111;margin:0 0 8px">Payment Confirmed!</h2>
<p style="color:#6b7280">Hi {customer.get('name','')}, your order has been confirmed.</p>
<table style="width:100%;margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
<tr><td style="padding:12px;font-size:13px;color:#6b7280">Invoice No.</td><td style="padding:12px;font-weight:600">{invoice.get('invoice_number','')}</td></tr>
<tr><td style="padding:12px;font-size:13px;color:#6b7280">Payment Method</td><td style="padding:12px;font-weight:600">{method_label}</td></tr>
<tr><td style="padding:12px;font-size:13px;color:#6b7280">Total Amount</td><td style="padding:12px;font-weight:600;color:#059669">Rs.{invoice.get('grand_total',0):.2f}</td></tr>
</table>
<h3 style="margin:24px 0 12px">Order Summary</h3>
{_items_table(invoice.get('line_items', []))}
<p style="margin:16px 0;color:#6b7280">{method_note}</p>
<p style="color:#059669;font-weight:600">Thank you for choosing Careable 360+!</p>"""
    return _send(email, f"Payment Confirmed - {invoice.get('invoice_number','')}", _base_html(body))

def send_payment_notification_to_admin(invoice: dict):
    if not ADMIN_EMAIL:
        return False
    customer = invoice.get("customer_details", {})
    method = invoice.get("payment_method", "online")
    method_label = "Cash on Delivery" if method == "cod" else "Online Payment"
    body = f"""<h2 style="color:#111;margin:0 0 8px">New Payment Received</h2>
<p style="color:#6b7280">A payment has been confirmed for the following order.</p>
<table style="width:100%;margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
<tr><td style="padding:12px;font-size:13px;color:#6b7280">Invoice No.</td><td style="padding:12px;font-weight:600">{invoice.get('invoice_number','')}</td></tr>
<tr><td style="padding:12px;font-size:13px;color:#6b7280">Customer</td><td style="padding:12px">{customer.get('name','')}</td></tr>
<tr><td style="padding:12px;font-size:13px;color:#6b7280">Email</td><td style="padding:12px">{customer.get('email','')}</td></tr>
<tr><td style="padding:12px;font-size:13px;color:#6b7280">Payment Method</td><td style="padding:12px;font-weight:600">{method_label}</td></tr>
<tr><td style="padding:12px;font-size:13px;color:#6b7280">Amount</td><td style="padding:12px;font-weight:600;color:#059669">Rs.{invoice.get('grand_total',0):.2f}</td></tr>
</table>
<h3 style="margin:24px 0 12px">Items Ordered</h3>
{_items_table(invoice.get('line_items', []))}"""
    return _send(ADMIN_EMAIL, f"Payment Received - {invoice.get('invoice_number','')} | {customer.get('name','')}", _base_html(body))

DELIVERY_LABELS = {
    "dispatched": {"title": "Order Dispatched", "color": "#3b82f6", "message": "Your order has been dispatched and is on its way to you."},
    "delivered": {"title": "Order Delivered", "color": "#047857", "message": "Your order has been delivered successfully. Thank you for your purchase!"},
    "returned": {"title": "Order Returned", "color": "#ef4444", "message": "Your order has been marked as returned. If you have any questions, please contact us."},
}

def send_delivery_status_email(invoice: dict, new_status: str):
    customer = invoice.get("customer_details", {})
    email = customer.get("email")
    if not email or new_status not in DELIVERY_LABELS:
        return False
    info = DELIVERY_LABELS[new_status]
    body = f"""<h2 style="color:#111;margin:0 0 8px">{info['title']}</h2>
<p style="color:#6b7280">Hi {customer.get('name','')},</p>
<div style="text-align:center;padding:24px;background:{info['color']}10;border-radius:12px;margin:16px 0">
<h3 style="color:{info['color']};margin:8px 0">{info['title']}</h3>
<p style="color:#6b7280">{info['message']}</p></div>
<table style="width:100%;margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
<tr><td style="padding:12px;font-size:13px;color:#6b7280">Invoice No.</td><td style="padding:12px;font-weight:600">{invoice.get('invoice_number','')}</td></tr>
<tr><td style="padding:12px;font-size:13px;color:#6b7280">Total Amount</td><td style="padding:12px;font-weight:600;color:#059669">Rs.{invoice.get('grand_total',0):.2f}</td></tr>
</table>
<h3 style="margin:24px 0 12px">Items</h3>
{_items_table(invoice.get('line_items', []))}
<p style="color:#059669;font-weight:600;margin-top:16px">Thank you for choosing Careable 360+!</p>"""
    return _send(email, f"{info['title']} - {invoice.get('invoice_number','')}", _base_html(body))

def send_refund_initiated_email(invoice: dict):
    customer = invoice.get("customer_details", {})
    email = customer.get("email")
    if not email:
        return False
    body = f"""<h2 style="color:#111;margin:0 0 8px">Refund Initiated</h2>
<p style="color:#6b7280">Hi {customer.get('name','')},</p>
<div style="text-align:center;padding:24px;background:#fef2f2;border-radius:12px;margin:16px 0">
<h3 style="color:#ef4444;margin:8px 0">Refund in Progress</h3>
<p style="color:#6b7280">We have initiated a refund for your order. The amount will be credited back to your original payment method.</p></div>
<table style="width:100%;margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
<tr><td style="padding:12px;font-size:13px;color:#6b7280">Invoice No.</td><td style="padding:12px;font-weight:600">{invoice.get('invoice_number','')}</td></tr>
<tr><td style="padding:12px;font-size:13px;color:#6b7280">Refund Amount</td><td style="padding:12px;font-weight:600;color:#ef4444">Rs.{invoice.get('grand_total',0):.2f}</td></tr>
</table>
<p style="color:#6b7280;margin-top:16px">Refunds typically take 5-7 business days to reflect in your account.</p>"""
    return _send(email, f"Refund Initiated - {invoice.get('invoice_number','')}", _base_html(body))
