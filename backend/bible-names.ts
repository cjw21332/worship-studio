// Legacy names from the supplied XML library. Keep unknown/custom names intact.
const names:Record<string,[string,string]>={
 englishamp:['Amplified Bible','AMP'],
 englishesv:['English Standard Version','ESV'],
 englishnib:['New International Version','NIV'],
 englishniv:['New International Version','NIV'],
 englishnkj:['New King James Version','NKJV'],
 englishnkjv:['New King James Version','NKJV'],
 englishnlt:['New Living Translation','NLT'],
 tagalog:['Ang Dating Biblia (Tagalog)','ADB'],
 americanstandardversion:['American Standard Version','ASV'],
 kingjamesversion:['King James Version','KJV'],
};
export function normalizeBibleName<T extends {name:string;abbreviation:string}>(value:T):T{
 const known=names[value.name.toLowerCase().replace(/[\s_-]+/g,'')];
 return known?{...value,name:known[0],abbreviation:known[1]}:value;
}
