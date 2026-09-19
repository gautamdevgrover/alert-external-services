import React, { useState, useEffect } from 'react';
import { Sliders, ShieldCheck, ShieldAlert, Save, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { ThresholdItem, ServiceListItem } from '../types';

export const ConfigurationPage: React.FC = () => {
  const [thresholds, setThresholds] = useState<ThresholdItem[]>([]);
  const [services, setServices] = useState<ServiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [threshData, servicesData] = await Promise.all([
        api.getThresholds(),
        api.getServices(),
      ]);
      setThresholds(threshData);
      setServices(servicesData);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFieldChange = (
    serviceKey: string,
    field: keyof ThresholdItem,
    value: any
  ) => {
    setThresholds((prev) =>
      prev.map((t) => (t.serviceKey === serviceKey ? { ...t, [field]: value } : t))
    );
  };

  const handleSave = async (t: ThresholdItem) => {
    try {
      setSavingKey(t.serviceKey);
      await api.updateThreshold(t.serviceKey, {
        warningThreshold: Number(t.warningThreshold),
        criticalThreshold: Number(t.criticalThreshold),
        alertCooldownMinutes: Number(t.alertCooldownMinutes),
        isEnabled: t.isEnabled,
      });
      setSaveSuccess(t.serviceKey);
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      alert('Failed to save configuration: ' + err.message);
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 text-sm flex flex-col items-center justify-center">
        <RefreshCw className="h-6 w-6 text-sky-400 animate-spin mb-2" />
        Loading threshold configurations...
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Sliders className="h-6 w-6 text-sky-400" />
          Threshold Rules & Service Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure warning and critical alert thresholds, cooldown limits, and inspect environment credential statuses.
        </p>
      </div>

      {/* Threshold Configurations Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-950/30">
          <h2 className="text-sm font-bold text-slate-200">Per-Service Threshold Policies</h2>
          <p className="text-xs text-slate-400">
            Define the boundaries at which CyberForce will trigger automated warning and critical alerts.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 sm:px-6">Service</th>
                <th className="py-3 px-4">Warning Threshold</th>
                <th className="py-3 px-4">Critical Threshold</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4">Alert Cooldown (Mins)</th>
                <th className="py-3 px-4">Monitoring Enabled</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {thresholds.map((t) => {
                const isSaving = savingKey === t.serviceKey;
                const isSaved = saveSuccess === t.serviceKey;

                return (
                  <tr key={t.serviceKey} className="hover:bg-slate-800/30">
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-200">
                      <div>{t.serviceName}</div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">{t.serviceKey}</span>
                    </td>

                    {/* Warning threshold */}
                    <td className="py-3.5 px-4">
                      <input
                        type="number"
                        step="any"
                        value={t.warningThreshold}
                        onChange={(e) =>
                          handleFieldChange(t.serviceKey, 'warningThreshold', e.target.value)
                        }
                        className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                      />
                    </td>

                    {/* Critical threshold */}
                    <td className="py-3.5 px-4">
                      <input
                        type="number"
                        step="any"
                        value={t.criticalThreshold}
                        onChange={(e) =>
                          handleFieldChange(t.serviceKey, 'criticalThreshold', e.target.value)
                        }
                        className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono text-xs focus:ring-1 focus:ring-rose-500 focus:outline-none"
                      />
                    </td>

                    {/* Unit */}
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {t.unit}
                    </td>

                    {/* Alert Cooldown */}
                    <td className="py-3.5 px-4">
                      <input
                        type="number"
                        value={t.alertCooldownMinutes}
                        onChange={(e) =>
                          handleFieldChange(t.serviceKey, 'alertCooldownMinutes', e.target.value)
                        }
                        className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                      />
                    </td>

                    {/* Toggle Enabled */}
                    <td className="py-3.5 px-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={t.isEnabled}
                          onChange={(e) =>
                            handleFieldChange(t.serviceKey, 'isEnabled', e.target.checked)
                          }
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                      </label>
                    </td>

                    {/* Save Button */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleSave(t)}
                        disabled={isSaving}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isSaved
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-200 border border-slate-700'
                        }`}
                      >
                        {isSaved ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                          </>
                        ) : (
                          <>
                            <Save className="h-3.5 w-3.5" /> {isSaving ? 'Saving...' : 'Save'}
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Credential Status Audit (Strictly no secrets exposed) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-950/30">
          <h2 className="text-sm font-bold text-slate-200">Credential Status Audit</h2>
          <p className="text-xs text-slate-400">
            Confirms whether the required environment variables are set. Secret values are never exposed or stored.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 sm:px-6">Service</th>
                <th className="py-3 px-4">Expected Environment Variables</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {services.map((s) => (
                <tr key={s.key} className="hover:bg-slate-800/30">
                  <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-200">
                    {s.name}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">
                    <div className="flex flex-wrap gap-1">
                      {s.envVarNames.map((v) => (
                        <span key={v} className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700/60">
                          {v}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {s.isConfigured ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                        <ShieldCheck className="h-3.5 w-3.5" /> Configured
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                        <ShieldAlert className="h-3.5 w-3.5" /> Not Configured
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
