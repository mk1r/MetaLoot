import {
  Button,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Image,
  Text,
  useDisclosure,
  useNumberInput,
  VStack,
} from '@chakra-ui/react';
import { useWallet } from '@meta-cred/usewallet';
import { BigNumber } from 'ethers';
import { formatEther, parseEther } from 'ethers/lib/utils';
import React, { useEffect, useState } from 'react';

import { AlertModal } from '@/components/AlertModal';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { maybePluralize } from '@/lib/stringHelpers';
import {
  useAgldBalance,
  useAGLDContract,
  useMetaLootContract,
  useMetaLootData,
  useTypedContractReader,
} from '@/lib/useContracts';
import { useTransactor } from '@/lib/useTransactor';

import { AmountSelector } from './AmountSelector';

const TOKEN_ID = '1';

export const MetaLootInfo: React.FC = () => {
  const [isApproving, setIsApproving] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const { address, provider, onboard } = useWallet();
  const { watchTx } = useTransactor(provider);

  const metaLoot = useMetaLootContract();
  const agld = useAGLDContract();
  const agldBalance = useAgldBalance();
  const alertModal = useDisclosure();

  const numberInputProps = useNumberInput({
    step: 1,
    defaultValue: 1,
    min: 1,
    max: 5,
  });

  useEffect(() => {
    onboard?.walletCheck();
  }, [onboard]);

  const readAllowance = useTypedContractReader(
    agld,
    'allowance',
    address || '',
    metaLoot.address,
  )({ refetchInterval: 10000 });

  const { data: isActive } = useTypedContractReader(
    metaLoot,
    'saleActive',
  )({
    refetchInterval: 5000,
  });
  const readSalePrice = useTypedContractReader(
    metaLoot,
    'salePrice',
  )({ enabled: isActive });
  const readTotalSupply = useTypedContractReader(
    metaLoot,
    'totalSupply',
    TOKEN_ID,
  )({ refetchInterval: 5000, enabled: isActive });
  const readMaxSupply = useTypedContractReader(
    metaLoot,
    'maxSupply',
  )({
    enabled: isActive,
  });

  const unitPrice =
    (readSalePrice.data && +formatEther(readSalePrice.data)) || 0;
  const totalSupply = readTotalSupply.data?.toNumber() || 0;
  const maxSupply = readMaxSupply.data?.toNumber() || 0;

  const price = unitPrice * numberInputProps.valueAsNumber;

  const hasEnoughAllowance =
    readSalePrice?.data && readAllowance.data?.gte(readSalePrice.data);

  const { loading, nft, reload } = useMetaLootData(TOKEN_ID);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const supplyAvailable = maxSupply - totalSupply;
  const isSoldOut = maxSupply === totalSupply;

  const supplyString =
    (supplyAvailable > 0 && isActive) || isSoldOut
      ? `${supplyAvailable} / ${maxSupply} available`
      : 'Not Available';

  const mintButtonDisabled =
    !isActive || supplyAvailable <= 0 || isApproving || isMinting;

  const onMint = async () => {
    if (!readAllowance.data || !readSalePrice.data) return;

    if (!price || agldBalance - price <= 0) {
      alertModal.onOpen();
      return;
    }

    if (!hasEnoughAllowance) {
      setIsApproving(true);
      const approveTx = agld.approve(metaLoot.address, parseEther('1000'));
      const approveRes = await watchTx(approveTx);
      setIsApproving(false);
      readAllowance.refetch();
      console.log({ approveRes });
    }

    setIsMinting(true);
    const buyTx = metaLoot.buyMetaLoot(
      BigNumber.from(numberInputProps.valueAsNumber),
    );
    const buyRes = await watchTx(buyTx);
    setIsMinting(false);
    readTotalSupply.refetch();
    console.log({ buyRes });
  };

  if (loading && !nft) return <LoadingState loading={loading} />;

  if (!nft) return <EmptyState title="Coming Soon" />;

  if (!nft) return null;

  return (
    <Grid
      templateColumns="minmax(200px, 1fr) 1fr"
      columnGap={6}
      rowGap={6}
      alignItems="center"
      justifyItems="center"
      mx={[4, 4, 2]}
    >
      <GridItem colSpan={[2, 2, 1]}>
        <Image src={nft.image} maxW={[350, 400, 500]} />
      </GridItem>

      <GridItem colSpan={[2, 2, 1]}>
        <VStack spacing={6} align="flex-start">
          <Heading>{nft.name}</Heading>
          <Text>{nft.description}</Text>
          <HStack w="100%">
            <Button
              disabled={mintButtonDisabled}
              isLoading={isApproving || isMinting}
              loadingText={isApproving ? 'Approving AGLD' : 'Minting'}
              variant="primary"
              onClick={onMint}
              size="md"
              w="100%"
              py={10}
            >
              <Flex justify="space-between" align="center" flex={1}>
                <Flex direction="column" align="flex-start">
                  <Text>
                    {isSoldOut
                      ? 'SOLD OUT'
                      : `MINT ${maybePluralize(
                          numberInputProps.valueAsNumber,
                          'BAG',
                        ).toUpperCase()}`}
                  </Text>
                  {supplyString && (
                    <Text fontSize="xs" color="gray.300" mt={1}>
                      {supplyString}
                    </Text>
                  )}
                </Flex>
                <Text color="yellow.400">{`${price} AGLD`}</Text>
              </Flex>
            </Button>
            <AmountSelector
              {...numberInputProps}
              isDisabled={mintButtonDisabled}
            />
          </HStack>

          <Button disabled onClick={onMint} w="100%" p={8} fontStyle="italic">
            REDEMPTION COMING SOON
          </Button>
        </VStack>
      </GridItem>
      <GridItem colSpan={2} align="center" mt={10}>
        <Image src="flatlay.png" />
      </GridItem>
      <AlertModal isOpen={alertModal.isOpen} onClose={alertModal.onClose} />
    </Grid>
  );
};
