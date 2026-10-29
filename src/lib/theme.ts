export const themeKey = "phantomcommit.theme.v1";
export const themeScript =
  'try{document.documentElement.dataset.theme=localStorage.getItem("phantomcommit.theme.v1")==="light"?"light":"dark"}catch{document.documentElement.dataset.theme="dark"}';
