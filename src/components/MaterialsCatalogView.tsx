import React from 'react';
import { MATERIALS_CATALOG } from '../data/materialsCatalog';
import { ShieldCheck, Activity, Layers } from 'lucide-react';

interface MaterialsCatalogViewProps {
  onSelectMaterialFilter?: (materialName: string) => void;
}

export const MaterialsCatalogView: React.FC<MaterialsCatalogViewProps> = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {MATERIALS_CATALOG.map((mat) => (
        <div
          key={mat.name}
          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 flex flex-col justify-between space-y-3"
        >
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 block">
                  {mat.category}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {mat.name}
                </h3>
                <span className="text-[11px] text-slate-400">{mat.origin}</span>
              </div>

              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] font-bold rounded-md shrink-0">
                <ShieldCheck className="w-3 h-3" />
                {mat.defaultWarranty}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                  <Activity className="w-3 h-3 text-teal-500" />
                  <span>Độ cứng</span>
                </div>
                <span className="font-extrabold text-xs text-slate-900 dark:text-white font-mono">
                  {mat.strengthMpa} MPa
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                  <Layers className="w-3 h-3 text-cyan-500" />
                  <span>Độ trong</span>
                </div>
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 font-mono">
                  {mat.translucency}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
              {mat.indications}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
