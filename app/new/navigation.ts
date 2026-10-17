const screens = new Set(["standings", "results", "wallpaper", "circuits", "about", "developer", "admin", "playground", "event"])
export function editionHref(href:string,inNew:boolean){
 if(!inNew||!href.startsWith("/")||href.startsWith("//"))return href
 const path=href.split(/[?#]/,1)[0]
 if(path==="/")return "/new"+href.slice(1)
 return screens.has(path.split("/")[1])?"/new"+href:href
}
