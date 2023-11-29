import { log } from './util/log';
import { Service } from './service';

let service: Service;

const initialize = async (): Promise<void> => {
  log('Initializing...');

  service = new Service();

  log('Successfully initialized.');
};

void initialize();
