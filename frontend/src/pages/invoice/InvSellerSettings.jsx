import { useState, useEffect } from 'react';
import { sellerAPI } from '../../services/invoiceApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Separator } from '../../components/ui/separator';
import { Building2, Phone, Mail, CreditCard, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function InvSellerSettings() {
  const [form, setForm] = useState({
    business_name: '', address: '', city: '', state: '', pincode: '',
    phone: '', email: '', gst_number: '', tax_id: '',
    bank_name: '', bank_account_number: '', bank_ifsc: '', bank_branch: '',
    logo_url: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    sellerAPI.get().then(r => { if (r.data && Object.keys(r.data).length) setForm(prev => ({ ...prev, ...r.data })); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try { await sellerAPI.update(form); toast.success('Settings saved!'); }
    catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  const f = (field) => ({
    value: form[field] || '',
    onChange: (e) => setForm(prev => ({ ...prev, [field]: e.target.value })),
  });

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" /></div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Seller Settings</h1>
          <p className="text-sm text-gray-500">Configure your business details for invoices</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800" data-testid="inv-save-settings">
          <Save className="w-4 h-4 mr-1" />{saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" />Business Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Business Name</Label><Input {...f('business_name')} data-testid="inv-seller-name" /></div>
          <div><Label>Logo URL</Label><Input {...f('logo_url')} /></div>
          <div className="sm:col-span-2"><Label>Address</Label><Input {...f('address')} /></div>
          <div><Label>City</Label><Input {...f('city')} /></div>
          <div><Label>State</Label><Input {...f('state')} /></div>
          <div><Label>Pincode</Label><Input {...f('pincode')} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Phone className="w-4 h-4" />Contact Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Phone</Label><Input {...f('phone')} data-testid="inv-seller-phone" /></div>
          <div><Label>Email</Label><Input {...f('email')} data-testid="inv-seller-email" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4" />Tax Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>GST Number</Label><Input {...f('gst_number')} data-testid="inv-seller-gst" /></div>
          <div><Label>Tax ID / PAN</Label><Input {...f('tax_id')} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="w-4 h-4" />Bank Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Bank Name</Label><Input {...f('bank_name')} /></div>
          <div><Label>Account Number</Label><Input {...f('bank_account_number')} /></div>
          <div><Label>IFSC Code</Label><Input {...f('bank_ifsc')} /></div>
          <div><Label>Branch</Label><Input {...f('bank_branch')} /></div>
        </CardContent>
      </Card>
    </div>
  );
}
