export const OFFICIAL_REVIEW_ADMIN_UID='LWRN6IDv4OV1PZd7Vldgp6F9pdH3';
export function officialReviewIdentity(data={}){return data.adminAuthorUid===OFFICIAL_REVIEW_ADMIN_UID&&data.adminIdentityConfirmed===true;}
export function reviewNameIssue(name,code,isAdmin=false){
 const value=String(name||'').trim().toUpperCase(),purchaseCode=String(code||'').trim().toUpperCase();
 if(value&&value===purchaseCode)return 'Jangan gunakan kod review sebagai nama. Masukkan nama atau username sendiri.';
 if(!isAdmin&&value.includes('H4SX'))return 'Nama H4SX dikhaskan untuk akaun admin rasmi yang disahkan.';
 return '';
}
