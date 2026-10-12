import path from 'node:path';
export default { resolve: { dedupe: ['react', 'react-dom', 'yjs'] }, server: { fs: { allow: [path.resolve('..')] } } };
