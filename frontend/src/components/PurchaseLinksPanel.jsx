import { useEffect, useState, useCallback } from "react";
import { Link as LinkIcon, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import apiService from "../services/api";

const DEFAULT_MEDICINE_ORDER_LINK = "https://encaremedicineordertrackdummy.netlify.app";

const EMPTY_FORM = {
  medicine_order_link: "",
  medicine_invoice_link: "",
  medicine_invoice_amount: "",
  injection_order_link: "",
  injection_invoice_link: "",
  injection_invoice_amount: "",
  product_order_link: "",
  product_invoice_link: "",
  product_invoice_amount: "",
};

/**
 * Shared Purchase Links editor used by both PM Dashboard (modal) and CRM Patient
 * Profile → Invoices & Orders tab (inline). Reads & writes via the same
 * `/api/prescription-manager/user/{id}/purchase-links` endpoint so both UIs stay
 * in sync — single source of truth.
 *
 * Props:
 *   userId    : string (required) — patient/user id
 *   userName  : string             — shown in the heading
 *   mode      : "inline" | "modal" — render style (default "inline")
 *   onClose   : fn                 — required for "modal" mode
 *   onSaved   : fn                 — fired after a successful save
 */
export default function PurchaseLinksPanel({
  userId,
  userName = "",
  mode = "inline",
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchLinks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const links = await apiService.getUserPurchaseLinks(userId);
      setForm({
        medicine_order_link: links.medicine_order_link || DEFAULT_MEDICINE_ORDER_LINK,
        medicine_invoice_link: links.medicine_invoice_link || "",
        medicine_invoice_amount:
          links.medicine_invoice_amount != null ? String(links.medicine_invoice_amount) : "",
        injection_order_link: links.injection_order_link || "",
        injection_invoice_link: links.injection_invoice_link || "",
        injection_invoice_amount:
          links.injection_invoice_amount != null ? String(links.injection_invoice_amount) : "",
        product_order_link: links.product_order_link || "",
        product_invoice_link: links.product_invoice_link || "",
        product_invoice_amount:
          links.product_invoice_amount != null ? String(links.product_invoice_amount) : "",
      });
    } catch (e) {
      setForm({ ...EMPTY_FORM, medicine_order_link: DEFAULT_MEDICINE_ORDER_LINK });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        medicine_invoice_amount: form.medicine_invoice_amount
          ? parseFloat(form.medicine_invoice_amount)
          : null,
        injection_invoice_amount: form.injection_invoice_amount
          ? parseFloat(form.injection_invoice_amount)
          : null,
        product_invoice_amount: form.product_invoice_amount
          ? parseFloat(form.product_invoice_amount)
          : null,
      };
      await apiService.updateUserPurchaseLinks(userId, payload);
      toast.success(userName ? `Purchase links saved for ${userName}` : "Purchase links saved");
      if (onSaved) onSaved();
    } catch (e) {
      toast.error(e?.message || "Failed to save purchase links");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(`Clear all purchase links${userName ? ` for ${userName}` : ""}?`)) return;
    setSaving(true);
    try {
      const emptyLinks = {
        medicine_order_link: null,
        medicine_invoice_link: null,
        medicine_invoice_amount: null,
        injection_order_link: null,
        injection_invoice_link: null,
        injection_invoice_amount: null,
        product_order_link: null,
        product_invoice_link: null,
        product_invoice_amount: null,
      };
      await apiService.updateUserPurchaseLinks(userId, emptyLinks);
      setForm(EMPTY_FORM);
      toast.success("Purchase links cleared");
      if (onSaved) onSaved();
    } catch (e) {
      toast.error(e?.message || "Failed to reset purchase links");
    } finally {
      setSaving(false);
    }
  };

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // ---- Body renderer (shared for both modes) ----
  const Body = (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
        </div>
      ) : (
        <div className="space-y-6" data-testid="purchase-links-panel-body">
          {/* Medicine Links */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="text-md font-semibold text-blue-900 mb-1 flex items-center gap-2">
              💊 Medicine Purchase Links
            </h3>
            <p className="text-xs text-blue-700 mb-4">
              These links will be shared across all tablets, capsules, and other medicine forms.
            </p>
            <div className="space-y-4">
              <FieldRow
                label="Medicine Order Link"
                type="url"
                placeholder="https://pharmacy-site.com/order/..."
                value={form.medicine_order_link}
                onChange={v => update("medicine_order_link", v)}
                accent="blue"
                testid="pm-medicine-order-link"
              />
              <FieldRow
                label="Medicine Invoice Link"
                type="url"
                placeholder="https://drive.google.com/invoice/..."
                value={form.medicine_invoice_link}
                onChange={v => update("medicine_invoice_link", v)}
                accent="blue"
                testid="pm-medicine-invoice-link"
              />
              <FieldRow
                label="Medicine Invoice Amount (₹)"
                type="text"
                inputMode="decimal"
                placeholder="e.g., 1500.00"
                value={form.medicine_invoice_amount}
                onChange={v => update("medicine_invoice_amount", v)}
                accent="blue"
                testid="pm-medicine-invoice-amount"
              />
            </div>
          </div>

          {/* Injection Links */}
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <h3 className="text-md font-semibold text-purple-900 mb-1 flex items-center gap-2">
              💉 Injection Purchase Links
            </h3>
            <p className="text-xs text-purple-700 mb-4">
              These links will be shared across all injection medications.
            </p>
            <div className="space-y-4">
              <FieldRow
                label="Injection Order Link"
                type="url"
                placeholder="https://pharmacy-site.com/order/..."
                value={form.injection_order_link}
                onChange={v => update("injection_order_link", v)}
                accent="purple"
                testid="pm-injection-order-link"
              />
              <FieldRow
                label="Injection Invoice Link"
                type="url"
                placeholder="https://drive.google.com/invoice/..."
                value={form.injection_invoice_link}
                onChange={v => update("injection_invoice_link", v)}
                accent="purple"
                testid="pm-injection-invoice-link"
              />
              <FieldRow
                label="Injection Invoice Amount (₹)"
                type="text"
                inputMode="decimal"
                placeholder="e.g., 2500.00"
                value={form.injection_invoice_amount}
                onChange={v => update("injection_invoice_amount", v)}
                accent="purple"
                testid="pm-injection-invoice-amount"
              />
            </div>
          </div>

          {/* Product Links */}
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200" data-testid="product-purchase-links-section">
            <h3 className="text-md font-semibold text-emerald-900 mb-1 flex items-center gap-2">
              🛒 Product Purchase Links
            </h3>
            <p className="text-xs text-emerald-700 mb-4">
              These links will be used for non-medicine product purchases (devices, supplements, accessories, etc.).
            </p>
            <div className="space-y-4">
              <FieldRow
                label="Product Order Link"
                type="url"
                placeholder="https://store.com/order/..."
                value={form.product_order_link}
                onChange={v => update("product_order_link", v)}
                accent="emerald"
                testid="pm-product-order-link"
              />
              <FieldRow
                label="Product Invoice Link"
                type="url"
                placeholder="https://drive.google.com/invoice/..."
                value={form.product_invoice_link}
                onChange={v => update("product_invoice_link", v)}
                accent="emerald"
                testid="pm-product-invoice-link"
              />
              <FieldRow
                label="Product Invoice Amount (₹)"
                type="text"
                inputMode="decimal"
                placeholder="e.g., 1200.00"
                value={form.product_invoice_amount}
                onChange={v => update("product_invoice_amount", v)}
                accent="emerald"
                testid="pm-product-invoice-amount"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-semibold disabled:opacity-50"
                data-testid="purchase-links-save-btn"
              >
                {saving ? "Saving..." : "Save Purchase Links"}
              </button>
              {mode === "modal" && (
                <button
                  onClick={onClose}
                  className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              )}
            </div>
            <button
              onClick={handleReset}
              disabled={saving}
              className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="purchase-links-reset-btn"
            >
              <RotateCcw className="w-4 h-4" />
              Reset All Links
            </button>
          </div>
        </div>
      )}
    </>
  );

  if (mode === "modal") {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <LinkIcon className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Purchase Links</h2>
                  {userName && <p className="text-sm text-gray-600">For {userName}</p>}
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            {Body}
          </div>
        </div>
      </div>
    );
  }

  // inline mode (rendered directly inside CRM Invoices & Orders tab)
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5" data-testid="purchase-links-panel-inline">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
          <LinkIcon className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900">Purchase Links</h3>
          <p className="text-xs text-gray-500">
            Auto-updates from invoices • permanent 1mg links {userName ? `• ${userName}` : ""}
          </p>
        </div>
      </div>
      {Body}
    </div>
  );
}

function FieldRow({ label, value, onChange, type = "text", inputMode, placeholder, accent = "blue", testid }) {
  const ringMap = {
    blue: "focus:ring-blue-500",
    purple: "focus:ring-purple-500",
    emerald: "focus:ring-emerald-500",
  };
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testid}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 ${ringMap[accent] || ringMap.blue} focus:border-transparent`}
      />
    </div>
  );
}
