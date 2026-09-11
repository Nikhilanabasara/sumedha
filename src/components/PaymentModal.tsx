import { useState, useRef } from 'react';
import { Upload, X, Loader2, CheckCircle2, Clock, XCircle, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Month, PaymentRequest } from '@/types';

interface Props {
  month: Month;
  gradeName: string;
  profileId: string;
  existingRequest: PaymentRequest | null;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function PaymentModal({ month, gradeName, profileId, existingRequest, onClose, onSubmitted }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const status = existingRequest?.status;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, etc.)');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum 10MB.');
      return;
    }
    setFile(f);
    setError('');
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function handleSubmit() {
    if (!file) {
      setError('Please select a bank slip photo to upload.');
      return;
    }
    setUploading(true);
    setError('');

    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${profileId}/${month.id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('bank-slips')
        .upload(fileName, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      if (existingRequest) {
        const { error: updateError } = await supabase
          .from('payment_requests')
          .update({ slip_url: fileName, status: 'pending' })
          .eq('id', existingRequest.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('payment_requests')
          .insert({
            user_id: profileId,
            month_id: month.id,
            slip_url: fileName,
            status: 'pending',
          });
        if (insertError) throw insertError;
      }

      setSuccess(true);
      setTimeout(() => {
        onSubmitted();
      }, 1500);
    } catch (err) {
      console.error('Payment upload failed', err);
      setError('Could not upload your slip. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-surface rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-app">
          <h2 className="text-lg font-bold">Purchase Month Access</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-app text-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Month info */}
          <div className="bg-app rounded-xl p-4">
            <div className="text-sm text-muted mb-1">Month</div>
            <div className="font-bold">{gradeName} — {month.month_name} {month.year}</div>
          </div>

          {/* Existing request status */}
          {status === 'pending' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 text-warning-700 dark:text-warning-400 text-sm">
              <Clock className="w-5 h-5 flex-shrink-0" />
              <span>Your previous slip is under review. You can re-upload if needed.</span>
            </div>
          )}
          {status === 'approved' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 text-success-700 dark:text-success-400 text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>Your payment was approved! You have access to this month.</span>
            </div>
          )}
          {status === 'rejected' && (
            <div className="px-4 py-3 rounded-xl bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 text-error-700 dark:text-error-400 text-sm">
              <div className="flex items-center gap-3 mb-1">
                <XCircle className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">Your payment was not approved.</span>
              </div>
              {existingRequest?.admin_note && (
                <p className="text-xs ml-8 mt-1 opacity-80">Admin note: {existingRequest.admin_note}</p>
              )}
              <p className="text-xs ml-8 mt-1 opacity-80">Please re-upload a valid bank slip.</p>
            </div>
          )}

          {success ? (
            <div className="text-center py-8 animate-fade-in">
              <CheckCircle2 className="w-14 h-14 text-success-500 mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-1">Slip Uploaded!</h3>
              <p className="text-muted text-sm">Your payment is now pending admin review.</p>
            </div>
          ) : (
            <>
              {/* Upload area */}
              <div>
                <label className="block text-sm font-medium text-muted mb-2">Bank Slip Photo</label>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-app rounded-xl p-8 flex flex-col items-center justify-center gap-3 hover:border-primary-500 transition-colors"
                >
                  {previewUrl ? (
                    <img src={previewUrl} alt="Slip preview" className="max-h-48 rounded-lg" />
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-full bg-app flex items-center justify-center">
                        <Upload className="w-6 h-6 text-muted" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-sm">Click to upload</p>
                        <p className="text-xs text-muted mt-1">JPG, PNG up to 10MB</p>
                      </div>
                    </>
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {previewUrl && (
                  <button
                    onClick={() => { setFile(null); setPreviewUrl(null); }}
                    className="mt-2 text-sm text-muted hover:text-error-600 transition-colors flex items-center gap-1"
                  >
                    <X className="w-4 h-4" /> Remove image
                  </button>
                )}
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-error-50 dark:bg-error-900/20 border border-error-100 dark:border-error-800 text-error-700 dark:text-error-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl border-2 border-app text-muted hover:text-app font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={uploading || !file}
                  className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                  {uploading ? 'Uploading...' : 'Submit Slip'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
