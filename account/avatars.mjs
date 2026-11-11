export const avatars = [{"id": "goldfish", "label": "Goldfish"}, {"id": "clownfish", "label": "Clownfish"}, {"id": "rainbow", "label": "Rainbow fish"}, {"id": "betta", "label": "Betta"}, {"id": "blue-tang", "label": "Blue tang"}, {"id": "guppy", "label": "Guppy"}];
export const avatarUrl = id => `https://broadwaypixels.com/account/avatars/${avatars.some(item=>item.id===id)?id:'goldfish'}.png`;
export function avatarId(url) { return avatars.find(item=>avatarUrl(item.id)===url)?.id || 'goldfish'; }
