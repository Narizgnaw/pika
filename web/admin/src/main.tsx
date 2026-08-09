import AdminApp from './App';
import {ensureRuntimeFallback, loadRuntimeConfig, renderApplication} from './bootstrap';

loadRuntimeConfig()
    .catch((error) => {
        console.error(error);
        ensureRuntimeFallback();
    })
    .finally(() => renderApplication(<AdminApp/>));
