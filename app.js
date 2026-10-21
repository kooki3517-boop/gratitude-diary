const sample={전혜나:[],오지용:[]};
const SUPABASE_URL='https://piysxzdcokmjvkcepriu.supabase.co';
const SUPABASE_KEY='sb_publishable_8sQdOKQT0oEysJzE5ZnQvQ_QU4mjXZ0';
const API=SUPABASE_URL+'/rest/v1/gratitude_entries';
const API_HEADERS={'apikey':SUPABASE_KEY,'Content-Type':'application/json'};
let data={전혜나:[],오지용:[]}, likes={};
let comments={}, commentsOpen={}, commentDrafts={}, commentAuthors={};
let replyTarget={},replyDrafts={},commentHeartSaving=new Set(), entryPhotos={},pendingPhotos=[],removedPhotos=[];
let editingCommentId=null, editingCommentText='', savingCommentId=null;
const COMMENTS_API=SUPABASE_URL+'/rest/v1/gratitude_comments';
const PHOTO_API=SUPABASE_URL+'/rest/v1/gratitude_photos';
const PHOTO_BUCKET=SUPABASE_URL+'/storage/v1/object/gratitude-photos';
let commentsReady=false; let current='전혜나', edit=null, delTarget=null;
function stamp(v){return v?new Date(v).toLocaleString('ko-KR',{hour12:false}).replace(/\. /g,'.').replace('. ',' '):''}
function rowToEntry(r){const tail=String(r.gratitude_3??'').split('\n').filter(Boolean);return [r.entry_date,[r.gratitude_1,r.gratitude_2,...tail],stamp(r.updated_at),r.id]}
async function api(path='',opts={}){const r=await fetch(API+path,{...opts,headers:{...API_HEADERS,...(opts.headers||{})}});if(!r.ok)throw new Error((await r.text())||('HTTP '+r.status));return r.status===204?null:await r.json()}
async function loadLikes(){
  const rows=await api('?select=id,liked');
  likes={};
  rows.forEach(r=>{likes[r.id]=!!r.liked});
}
async function loadShared(){
  try{
    const rows=await api('?select=id,person,entry_date,gratitude_1,gratitude_2,gratitude_3,updated_at,liked&order=entry_date.desc,updated_at.desc');
    data={전혜나:[],오지용:[]};likes={};
    rows.forEach(r=>{if(data[r.person])data[r.person].push(rowToEntry(r));likes[r.id]=!!r.liked});
    render();
    await refreshComments();
    await refreshPhotos();
  }catch(e){console.error('Supabase load failed',e);render()}
}
let syncingLikes=false;
async function refreshLikes(){
  if(syncingLikes||document.hidden)return;
  syncingLikes=true;
  try{
    const rows=await api('?select=id,liked');
    const next={};
    rows.forEach(r=>next[r.id]=!!r.liked);
    if(JSON.stringify(next)!==JSON.stringify(likes)){likes=next;render()}
  }catch(e){console.error('Heart sync failed',e)}
  finally{syncingLikes=false}
}
setInterval(refreshLikes,10000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLikes()});
window.addEventListener('focus',refreshLikes);

const $=s=>document.querySelector(s), shade=$('.shade');
const expanded={전혜나:false,오지용:false};
function esc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function render(){
  [['전혜나','#hEntries'],['오지용','#jEntries']].forEach(([n,id])=>{
    const all=data[n]||[], visible=expanded[n]?all:all.slice(0,1);
    $(id).innerHTML=visible.map((e,i)=>`<article class="entry"><div class="entryHead">${e[0].replaceAll('-','.')} (${['일','월','화','수','목','금','토'][new Date(e[0]+'T12:00').getDay()]})<span class="icons"><button class="heartBtn ${likes[e[3]]?'liked':''}" type="button" title="좋아요" aria-label="좋아요" data-action="heart" data-id="${e[3]}"><svg class="miniIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8Z" fill="${likes[e[3]]?'#e32636':'none'}" stroke="${likes[e[3]]?'#e32636':'#91416a'}"/></svg></button><button class="editBtn" type="button" title="수정" aria-label="수정" data-action="edit" data-who="${n}" data-index="${i}"><svg class="miniIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.4-.9L20 7.5 16.5 4 4.9 15.6 4 20Z"/><path d="m14.8 5.8 3.5 3.5"/></svg></button><button class="deleteBtn" type="button" title="삭제" aria-label="삭제" data-action="delete" data-who="${n}" data-index="${i}"><svg class="miniIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19"/></svg></button></span></div><ol>${e[1].map(x=>`<li>${esc(x)}</li>`).join('')}</ol><div class="saved">◷ 마지막 저장 ${e[2]||e[0].replaceAll('-','.')+' 21:46'}</div>${renderPhotos(e[3])}${renderCommentBox(e[3],n)}</article>`).join('')+(all.length>1?`<button class="moreDiary" type="button" data-action="more" data-who="${n}">${expanded[n]?'지난 일기 접기':'지난 일기 더보기'} ${expanded[n]?'▲':'▼'}</button>`:'');
  });
}
function commentTime(v){try{return new Date(v).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})}catch(_){return ''}}
async function commentApi(path='',opts={}){
  const r=await fetch(COMMENTS_API+path,{...opts,headers:{...API_HEADERS,...(opts.headers||{})}});
  if(!r.ok)throw new Error((await r.text())||('HTTP '+r.status));
  return r.status===204?null:await r.json();
}
let commentRefreshing=false;
async function refreshComments(){
  if(commentRefreshing||document.hidden)return;
  commentRefreshing=true;
  try{
    const rows=await commentApi('?select=id,entry_id,author,content,created_at,parent_id,liked&order=created_at.asc');
    const next={};rows.forEach(r=>{(next[r.entry_id]??=[]).push(r)});
    if(JSON.stringify(next)!==JSON.stringify(comments)){comments=next;if(editingCommentId===null)render()}
    commentsReady=true;
  }catch(e){console.error('Comments load failed',e)}
  finally{commentRefreshing=false}
}
setInterval(refreshComments,10000);
window.addEventListener('focus',refreshComments);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshComments()});
function renderCommentBox(entryId,diaryOwner){
  const list=comments[entryId]||[],open=!!commentsOpen[entryId];
  const author=commentAuthors[entryId]||(diaryOwner==='전혜나'?'오지용':'전혜나');
  const item=(c,reply=false)=>`<div class="commentItem ${reply?'replyItem':''}"><div class="commentMeta"><b>${esc(c.author)}</b><time>${esc(commentTime(c.created_at))}</time><span class="commentActions"><button type="button" class="commentEdit" data-action="editComment" data-comment-id="${c.id}" data-id="${entryId}" title="댓글 수정"><svg class="miniIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.4-.9L20 7.5 16.5 4 4.9 15.6 4 20Z"/><path d="m14.8 5.8 3.5 3.5"/></svg></button><button type="button" class="commentDelete" data-action="deleteComment" data-comment-id="${c.id}" data-id="${entryId}" title="댓글 삭제"><svg class="miniIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19"/></svg></button></span></div>${editingCommentId===c.id?`<div class="commentEditor"><textarea data-edit-comment="${c.id}" maxlength="500" rows="3">${esc(editingCommentText)}</textarea><div><button type="button" data-action="cancelCommentEdit">취소</button><button type="button" data-action="saveCommentEdit" data-comment-id="${c.id}" data-id="${entryId}">저장</button></div></div>`:`<div class="commentText">${esc(c.content)}</div>`}</div>`;
  const roots=list.filter(c=>!c.parent_id||!list.some(p=>p.id===c.parent_id));
  const children=id=>list.filter(c=>c.parent_id===id);
  return `<div class="commentArea"><button type="button" class="commentToggle" data-action="comments" data-id="${entryId}">댓글 ${list.length} ${open?'접기 ▲':'보기 ▼'}</button>${open?`<div class="commentPanel">${roots.map(c=>item(c)+children(c.id).map(r=>item(r,false)).join('')).join('')||'<div class="commentEmpty">아직 댓글이 없어요.</div>'}<div class="commentComposer"><select data-comment-author="${entryId}" aria-label="댓글 작성자"><option value="전혜나" ${author==='전혜나'?'selected':''}>전혜나</option><option value="오지용" ${author==='오지용'?'selected':''}>오지용</option></select><textarea data-comment-input="${entryId}" maxlength="500" rows="2" placeholder="댓글을 남겨 보세요..">${esc(commentDrafts[entryId]||'')}</textarea><button type="button" data-action="sendComment" data-id="${entryId}">남기기</button></div></div>`:''}</div>`;
}
async function sendComment(id,button){
  const field=document.querySelector(`[data-comment-input="${id}"]`);
  const authorField=document.querySelector(`[data-comment-author="${id}"]`);
  if(!field||!authorField)return;
  const content=field.value.trim(),author=authorField.value;
  if(!content||!['전혜나','오지용'].includes(author))return;
  button.disabled=true;commentDrafts[id]=content;commentAuthors[id]=author;
  try{
    await commentApi('',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({entry_id:Number(id),author,content,parent_id:null})});
    commentDrafts[id]='';await refreshComments();
  }catch(e){console.error('Comment save failed',e);alert('댓글 저장에 실패했어. Supabase 댓글 테이블 설정을 확인해 줘.')}finally{button.disabled=false}
}
async function deleteComment(id,commentId){
  if(!confirm('이 댓글을 삭제할까요?'))return;
  try{
    const rows=await commentApi('?id=eq.'+encodeURIComponent(commentId)+'&entry_id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:{Prefer:'return=representation'}});
    if(!Array.isArray(rows)||rows.length!==1)throw new Error('Delete not confirmed');
    await refreshComments();
  }catch(e){console.error('Comment delete failed',e);alert('댓글 삭제에 실패했어.')}
}
function beginCommentEdit(entryId,commentId){
  const c=(comments[entryId]||[]).find(x=>String(x.id)===String(commentId));
  if(!c)return;
  editingCommentId=c.id;editingCommentText=c.content;render();
  const field=document.querySelector('[data-edit-comment="'+c.id+'"]');
  if(field)field.focus();
}
function cancelCommentEdit(){editingCommentId=null;editingCommentText='';render();}
async function saveCommentEdit(entryId,commentId){
  if(savingCommentId!==null)return;
  const content=editingCommentText.trim();
  if(!content){alert('댓글 내용을 입력해 줘.');return;}
  savingCommentId=commentId;
  try{
    const rows=await commentApi('?id=eq.'+encodeURIComponent(commentId)+'&entry_id=eq.'+encodeURIComponent(entryId),{
      method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({content})
    });
    if(!Array.isArray(rows)||rows.length!==1)throw new Error('Comment update not confirmed');
    editingCommentId=null;editingCommentText='';
    await refreshComments();
  }catch(e){console.error('Comment edit failed',e);alert('댓글 수정에 실패했어. Supabase 수정 권한을 확인해 줘.')}
  finally{savingCommentId=null;}
}
async function toggleCommentLike(entryId,commentId){
  if(commentHeartSaving.has(commentId))return;
  const c=(comments[entryId]||[]).find(x=>String(x.id)===String(commentId));if(!c)return;
  commentHeartSaving.add(commentId);const previous=!!c.liked;c.liked=!previous;render();
  try{const rows=await commentApi('?id=eq.'+encodeURIComponent(commentId),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({liked:!previous})});if(!rows||rows.length!==1)throw Error('No updated comment')}
  catch(e){c.liked=previous;render();alert('댓글 하트 저장에 실패했어.')}
  finally{commentHeartSaving.delete(commentId)}
}
async function sendReply(entryId,parentId,button){
  const content=(replyDrafts[entryId]||'').trim();if(!content)return;
  button.disabled=true;
  try{await commentApi('',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({entry_id:Number(entryId),author:commentAuthors[entryId]||(findDiaryOwner(entryId)==='전혜나'?'오지용':'전혜나'),content,parent_id:Number(parentId)})});replyTarget[entryId]=null;replyDrafts[entryId]='';await refreshComments()}
  catch(e){console.error(e);alert('답글 저장에 실패했어.')}
  finally{button.disabled=false}
}
function findDiaryOwner(id){return Object.keys(data).find(n=>data[n].some(e=>String(e[3])===String(id)))}
async function photoApi(path='',opts={}){
 const r=await fetch(PHOTO_API+path,{...opts,headers:{...API_HEADERS,...opts.headers}});
 if(!r.ok)throw Error(await r.text());return r.status===204?null:r.json();
}
async function refreshPhotos(){
 try{const rows=await photoApi('?select=id,entry_id,storage_path,created_at&order=created_at.asc');const next={};rows.forEach(r=>(next[r.entry_id]??=[]).push(r));if(JSON.stringify(next)!==JSON.stringify(entryPhotos)){entryPhotos=next;render()}}
 catch(e){console.error('Photo sync failed',e)}
}
setInterval(refreshPhotos,15000);
window.addEventListener('focus',refreshPhotos);
function photoUrl(path){return SUPABASE_URL+'/storage/v1/object/public/gratitude-photos/'+path.split('/').map(encodeURIComponent).join('/')}
function renderPhotos(id){const photos=entryPhotos[id]||[];return photos.length?`<div class="entryPhotos">${photos.map(p=>`<a href="${esc(photoUrl(p.storage_path))}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(photoUrl(p.storage_path))}" alt="감사일기 사진"></a>`).join('')}</div>`:''}
function renderExistingPhotos(entryId){const box=$('#existingPhotoList');box.innerHTML=(entryPhotos[entryId]||[]).map(p=>`<div class="pendingPhoto" data-existing-photo="${p.id}"><img src="${esc(photoUrl(p.storage_path))}" alt="첨부 사진" style="width:54px;height:54px;object-fit:cover"><button type="button" data-remove-existing="${p.id}">삭제</button></div>`).join('')}
function renderPendingPhotos(){const el=$('#pendingPhotoList');if(!el)return;el.innerHTML=pendingPhotos.map((p,i)=>`<div class="pendingPhoto"><img src="${esc(p.url)}" alt="선택한 사진 미리보기" class="photoPreview"><button type="button" data-remove-pending="${i}">×</button></div>`).join('')+removedPhotos.map(p=>`<div class="pendingPhoto"><span>삭제 예정: 사진</span><button type="button" data-undo-remove="${p.id}">취소</button></div>`).join('')}
function resetPhotoEditor(){const box=$('#existingPhotoList');if(box)box.innerHTML='';pendingPhotos=[];removedPhotos=[];renderPendingPhotos()}
async function filePhotos(files){
 for(const file of Array.from(files)){
  if(!file.type.startsWith('image/')&&!/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name))continue;
  if(file.size>10*1024*1024){alert('사진은 한 장당 10MB 이하로 선택해 줘.');continue}
  try{
   const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file)});
   const img=new Image();
   await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Unsupported image format'));img.src=url});
   pendingPhotos.push({file,url});renderPendingPhotos();
  }catch(err){console.error('Photo preview failed',err);alert('이 사진은 브라우저에서 표시할 수 없어. 갤러리에서 JPG 또는 PNG 사진으로 선택해 줘.')}
 }
}
async function uploadPhoto(file,entryId){
 const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
 const path=entryId+'/'+crypto.randomUUID()+'.'+ext;
 const r=await fetch(PHOTO_BUCKET+'/'+path,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':file.type,'x-upsert':'false'},body:file});
 if(!r.ok)throw Error('Photo upload: '+await r.text());
 try{await photoApi('',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({entry_id:entryId,storage_path:path})})}
 catch(e){await fetch(PHOTO_BUCKET+'/'+path,{method:'DELETE',headers:{apikey:SUPABASE_KEY}}).catch(()=>{});throw e}
}
async function removePhoto(p){await photoApi('?id=eq.'+p.id,{method:'DELETE',headers:{Prefer:'return=representation'}});await fetch(PHOTO_BUCKET+'/'+p.storage_path,{method:'DELETE',headers:{apikey:SUPABASE_KEY}})}
function togglePast(n){expanded[n]=!expanded[n];render();}
render();loadShared();refreshPhotos();
function show(id){shade.classList.remove('hidden');$(id).classList.remove('hidden')}function close(){shade.classList.add('hidden');document.querySelectorAll('.dialog').forEach(x=>x.classList.add('hidden'))}document.querySelectorAll('.close,.cancel').forEach(x=>x.onclick=close);shade.onclick=close;
function setWriteRows(vals=['','','']){const box=$('#writeRows');box.innerHTML='';const arr=vals.length>=3?vals:['','',''];arr.forEach((v,i)=>addWriteRow(v,i));}
function addWriteRow(v='',i=null){const box=$('#writeRows'), n=i==null?box.children.length:i;const row=document.createElement('div');row.className='row';row.innerHTML=`<b>${n+1}</b><input class="gratitudeInput" value="${esc(v)}" placeholder="${n===0?'오늘 감사한 일을 적어 보세요':n===1?'적을수록 행복해집니다..':n===2?'지금 운명이 당신을 발견했어요.':n===9?'박수!':'..'}">`;box.appendChild(row);row.querySelector('input').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.value.trim()&&row===box.lastElementChild){e.preventDefault();addWriteRow();box.lastElementChild.querySelector('input').focus();}})}
document.querySelectorAll('.plus').forEach(b=>b.onclick=()=>{current=b.dataset.who;edit=null;const who=$('#who');if(who)who.textContent=current;$('#date').value=new Date().toISOString().slice(0,10);setWriteRows();resetPhotoEditor();show('#write')});
function openEdit(n,i){current=n;edit=i;let e=data[n][i];if(!e)return;const who=$('#who');if(who)who.textContent=n;$('#date').value=e[0];setWriteRows(e[1]);resetPhotoEditor();renderExistingPhotos(e[3]);show('#write');}
$('#save').onclick=async()=>{
 const btn=$('#save'),vals=[...document.querySelectorAll('#writeRows .gratitudeInput')].map(x=>x.value.trim()).filter(Boolean),date=$('#date').value;
 if(!date||vals.length<3)return;btn.disabled=true;
 try{
  const body={person:current,entry_date:date,gratitude_1:vals[0],gratitude_2:vals[1],gratitude_3:vals.slice(2).join('\n'),updated_at:new Date().toISOString()};
  const rows=await api('?on_conflict=person,entry_date',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(body)});
  const entryId=rows?.[0]?.id;if(!entryId)throw Error('Entry id missing');
  let failures=0;
  for(const p of pendingPhotos){try{await uploadPhoto(p.file,entryId)}catch(e){failures++;console.error(e)}}
  for(const p of removedPhotos){try{await removePhoto(p)}catch(e){failures++;console.error(e)}}
  await loadShared();await refreshPhotos();close();resetPhotoEditor();show('#savedPop');
  if(failures)alert('일기는 저장됐지만 사진 '+failures+'개 처리에 실패했어. Storage 설정을 확인해 줘.');
 }catch(e){console.error('Supabase save failed',e);alert('저장에 실패했습니다. 잠시 후 다시 시도해주세요.')}
 finally{btn.disabled=false}
};
$('#photoInput').addEventListener('change',e=>{filePhotos(e.target.files);e.target.value=''});
$('#pendingPhotoList').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.removeExisting){const photo=Object.values(entryPhotos).flat().find(p=>String(p.id)===b.dataset.removeExisting);if(photo&&!removedPhotos.some(p=>p.id===photo.id)){removedPhotos.push(photo);document.querySelector('[data-existing-photo=\"'+photo.id+'\"]')?.remove()}}
 if(b.dataset.removePending!==undefined){const p=pendingPhotos.splice(Number(b.dataset.removePending),1)[0];}
 if(b.dataset.undoRemove){removedPhotos=removedPhotos.filter(p=>String(p.id)!==b.dataset.undoRemove)}renderPendingPhotos()});

function askDelete(n,i){delTarget=[n,i];show('#confirm');}
const heartSaving=new Set();
async function toggleHeart(id){
  if(heartSaving.has(id))return;
  heartSaving.add(id);
  const previous=!!likes[id],next=!previous;
  likes[id]=next;render();
  try{
    await api('?id=eq.'+encodeURIComponent(id),{
      method:'PATCH',
      headers:{'Prefer':'return=representation'},
      body:JSON.stringify({liked:next})
    }).then(rows=>{if(!Array.isArray(rows)||rows.length!==1)throw new Error('Heart update not saved')});
  }catch(e){
    likes[id]=previous;render();
    console.error('Heart save failed',e);
    alert('하트 저장에 실패했어. 인터넷 연결을 확인하고 다시 눌러줘.');
  }finally{heartSaving.delete(id)}
}
$('.columns').addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(!b)return;if(b.dataset.action==='heart'){toggleHeart(b.dataset.id);return}
if(b.dataset.action==='comments'){const id=b.dataset.id;commentsOpen[id]=!commentsOpen[id];render();return}
if(b.dataset.action==='sendComment'){sendComment(b.dataset.id,b);return}
if(b.dataset.action==='editComment'){beginCommentEdit(b.dataset.id,b.dataset.commentId);return}
if(b.dataset.action==='cancelCommentEdit'){cancelCommentEdit();return}
if(b.dataset.action==='saveCommentEdit'){saveCommentEdit(b.dataset.id,b.dataset.commentId);return}
if(b.dataset.action==='deleteComment'){deleteComment(b.dataset.id,b.dataset.commentId);return}const n=b.dataset.who,i=Number(b.dataset.index);if(b.dataset.action==='edit')openEdit(n,i);else if(b.dataset.action==='delete')askDelete(n,i);else if(b.dataset.action==='more')togglePast(n);});
$('.columns').addEventListener('input',e=>{const el=e.target;if(el.matches('[data-comment-input]'))commentDrafts[el.dataset.commentInput]=el.value;if(el.matches('[data-edit-comment]'))editingCommentText=el.value;});
$('.columns').addEventListener('change',e=>{const el=e.target;if(el.matches('[data-comment-author]'))commentAuthors[el.dataset.commentAuthor]=el.value});
$('#del').onclick=async()=>{if(!delTarget)return;let[n,i]=delTarget,e=data[n][i];if(!e)return;try{await api('?id=eq.'+encodeURIComponent(e[3]),{method:'DELETE',headers:{'Prefer':'return=minimal'}});delTarget=null;await loadShared();close()}catch(err){console.error('Supabase delete failed',err);alert('삭제에 실패했습니다. 잠시 후 다시 시도해주세요.')}};

// Web Audio BGM: no HTMLMediaElement, to reduce system media playback notifications.
const volume=$('#volume');
let bgmOn=true, audioCtx=null, bgmBuffer=null, bgmSource=null, bgmGain=null;
let bgmOffset=0, bgmStartedAt=0, bgmPending=false, bgmLoad=null, bgmStartToken=0;
function audioContext(){
  if(!audioCtx){
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return null;
    audioCtx=new AC();
    bgmGain=audioCtx.createGain();
    bgmGain.gain.value=Number(volume.value)/100;
    bgmGain.connect(audioCtx.destination);
  }
  return audioCtx;
}
function loadBgm(){
  const ctx=audioContext();
  if(!ctx)return Promise.reject(new Error('Web Audio unavailable'));
  if(!bgmLoad)bgmLoad=fetch('./bgm.wav').then(r=>{
    if(!r.ok)throw new Error('BGM fetch failed');
    return r.arrayBuffer();
  }).then(data=>ctx.decodeAudioData(data)).then(buffer=>bgmBuffer=buffer)
    .catch(err=>{bgmLoad=null;throw err;});
  return bgmLoad;
}
function stopBgm(){
  bgmStartToken++;
  if(bgmSource){
    if(bgmBuffer)bgmOffset=(bgmOffset+Math.max(0,audioCtx.currentTime-bgmStartedAt))%bgmBuffer.duration;
    try{bgmSource.stop();}catch(_){}
    try{bgmSource.disconnect();}catch(_){}
    bgmSource=null;
  }
}
async function startBgm(){
  if(!bgmOn||document.hidden||!document.hasFocus()||bgmSource)return;
  const ctx=audioContext();
  if(!ctx)return;
  const token=++bgmStartToken;
  try{
    // Resume immediately in the user's gesture before waiting for the WAV download.
    const resumed=ctx.resume();
    await resumed;
    await loadBgm();
    if(token!==bgmStartToken||!bgmOn||document.hidden||!document.hasFocus()||bgmSource)return;
    const src=ctx.createBufferSource();
    src.buffer=bgmBuffer;src.loop=true;src.connect(bgmGain);
    bgmStartedAt=ctx.currentTime;
    src.start(0,bgmOffset%bgmBuffer.duration);
    bgmSource=src;
  }catch(_){}
}
function pauseBgmForBackground(){stopBgm();}
function resumeBgmIfVisible(){if(bgmOn&&!document.hidden&&document.hasFocus())startBgm();}
function updateMusicButton(){
  const b=$('#music');b.classList.toggle('off',!bgmOn);b.textContent=bgmOn?'♪':'×♪';
  b.title=bgmOn?'BGM 끄기':'BGM 켜기';b.setAttribute('aria-label',b.title);
}
$('#music').onclick=e=>{
  e.preventDefault();e.stopPropagation();bgmOn=!bgmOn;updateMusicButton();
  if(bgmOn)startBgm();else stopBgm();
};
volume.oninput=()=>{
  if(bgmGain)bgmGain.gain.value=Number(volume.value)/100;
  if(bgmOn&&!bgmSource)startBgm();
};
const firstGesture=()=>{if(bgmOn&&!bgmSource)startBgm();};
document.addEventListener('pointerdown',firstGesture,{capture:true,passive:true});
document.addEventListener('touchend',firstGesture,{capture:true,passive:true});
document.addEventListener('click',firstGesture,true);
window.addEventListener('pageshow',resumeBgmIfVisible);
document.addEventListener('DOMContentLoaded',startBgm);
window.addEventListener('load',startBgm);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)pauseBgmForBackground();else resumeBgmIfVisible();
});
window.addEventListener('blur',pauseBgmForBackground);
window.addEventListener('focus',resumeBgmIfVisible);
window.addEventListener('pagehide',pauseBgmForBackground);
startBgm();updateMusicButton();

if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js');}

/* v34: only the heart LIKE sound remains. No general button/click sound. */
(()=>{
 const magicAudio=new Audio('./magic.wav?v=34');
 magicAudio.preload='auto';
 magicAudio.volume=.88;
 const play=()=>{try{magicAudio.pause();magicAudio.currentTime=0;const p=magicAudio.play();if(p&&p.catch)p.catch(()=>{});}catch(_){}};
 document.addEventListener('pointerdown',e=>{
   const b=e.target.closest('button[data-action="heart"]');
   if(!b)return;
   if(!likes[b.dataset.id]) play(); // ♡ -> ♥ only
 },true);
})();
