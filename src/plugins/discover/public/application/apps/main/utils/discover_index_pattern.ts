export function simplifyFun(title: string){
  const reg=/-[A-z0-9]{8}$/
  if (typeof title === 'string'&&reg.test(title)) {
    return title.slice(0, -9);
  }
  return title;
};