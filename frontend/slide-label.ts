import type{Item}from'../backend/database';
export function slideLabel(item:Item,index:number){const id=item.sectionIds?.[index];return item.songSnapshot?.sections.find(s=>s.id===id)?.label||item.biblePages?.[index]?.reference||'';}
